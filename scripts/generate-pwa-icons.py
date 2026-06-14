import argparse
import os
import struct
import zlib

OUT = 'assets/icons'
ICON_SIZES = (180, 192, 512)


def read_png(path):
    data = open(path, 'rb').read()
    pos = 8
    width = height = color_type = bit_depth = None
    idat = b''

    while pos < len(data):
        length = struct.unpack('>I', data[pos:pos + 4])[0]
        chunk_type = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length

        if chunk_type == b'IHDR':
            width, height, bit_depth, color_type, _, _, _ = struct.unpack('>IIBBBBB', chunk)
        elif chunk_type == b'IDAT':
            idat += chunk
        elif chunk_type == b'IEND':
            break

    if bit_depth != 8 or color_type not in (2, 6):
        raise ValueError('Source icon must be an 8-bit RGB or RGBA PNG')

    channels = 4 if color_type == 6 else 3
    raw = zlib.decompress(idat)
    stride = width * channels
    rows = []
    index = 0
    previous = [0] * stride

    for _ in range(height):
        filter_type = raw[index]
        index += 1
        scanline = list(raw[index:index + stride])
        index += stride
        reconstructed = [0] * stride

        for x, value in enumerate(scanline):
            left = reconstructed[x - channels] if x >= channels else 0
            above = previous[x]
            upper_left = previous[x - channels] if x >= channels else 0

            if filter_type == 0:
                result = value
            elif filter_type == 1:
                result = (value + left) & 255
            elif filter_type == 2:
                result = (value + above) & 255
            elif filter_type == 3:
                result = (value + ((left + above) // 2)) & 255
            elif filter_type == 4:
                predictor = left + above - upper_left
                pa = abs(predictor - left)
                pb = abs(predictor - above)
                pc = abs(predictor - upper_left)
                predicted = left if pa <= pb and pa <= pc else (above if pb <= pc else upper_left)
                result = (value + predicted) & 255
            else:
                raise ValueError(f'Unsupported PNG filter: {filter_type}')

            reconstructed[x] = result

        if channels == 4:
            rgba = reconstructed
        else:
            rgba = []
            for x in range(0, len(reconstructed), 3):
                rgba.extend((reconstructed[x], reconstructed[x + 1], reconstructed[x + 2], 255))
        rows.append(rgba)
        previous = reconstructed

    return width, height, rows


def write_png(path, width, height, rows):
    raw = b''.join(b'\x00' + bytes(row) for row in rows)

    def chunk(chunk_type, data):
        checksum = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + chunk_type + data + struct.pack('>I', checksum)

    png = (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(raw, 9))
        + chunk(b'IEND', b'')
    )
    open(path, 'wb').write(png)


def sample_bilinear(rows, width, height, x, y):
    x0 = max(0, min(width - 1, int(x)))
    y0 = max(0, min(height - 1, int(y)))
    x1 = min(width - 1, x0 + 1)
    y1 = min(height - 1, y0 + 1)
    fx = x - x0
    fy = y - y0
    out = []

    for channel in range(4):
        top = rows[y0][x0 * 4 + channel] * (1 - fx) + rows[y0][x1 * 4 + channel] * fx
        bottom = rows[y1][x0 * 4 + channel] * (1 - fx) + rows[y1][x1 * 4 + channel] * fx
        out.append(round(top * (1 - fy) + bottom * fy))

    return out


def resize(rows, width, height, size):
    output = [[0] * (size * 4) for _ in range(size)]
    scale_x = width / size
    scale_y = height / size

    for y in range(size):
        source_y = (y + 0.5) * scale_y - 0.5
        for x in range(size):
            source_x = (x + 0.5) * scale_x - 0.5
            output[y][x * 4:x * 4 + 4] = sample_bilinear(rows, width, height, source_x, source_y)

    return output


def main():
    parser = argparse.ArgumentParser(description='Generate PWA app icon PNGs from a source PNG.')
    parser.add_argument('source', help='Path to the source app icon PNG to resize.')
    args = parser.parse_args()

    os.makedirs(OUT, exist_ok=True)
    width, height, rows = read_png(args.source)

    if width != height:
        raise ValueError('Source icon must be square for app icon generation')

    for size in ICON_SIZES:
        write_png(f'{OUT}/icon-{size}.png', size, size, resize(rows, width, height, size))

    print('generated', ', '.join(f'{OUT}/icon-{size}.png' for size in ICON_SIZES))


if __name__ == '__main__':
    main()
