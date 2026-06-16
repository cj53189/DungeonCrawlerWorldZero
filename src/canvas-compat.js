(function installCanvasTransformCompatibilityGuard() {
  const proto = window.CanvasRenderingContext2D?.prototype;
  if (!proto || proto.setTransform.__dcwCompatGuard) return;

  const nativeSetTransform = proto.setTransform;
  proto.setTransform = function setTransformCompat(a, b, c, d, e, f) {
    if (arguments.length === 5 && typeof a === "number") {
      return nativeSetTransform.call(this, a, b, c, d, e, 0);
    }
    return nativeSetTransform.apply(this, arguments);
  };
  proto.setTransform.__dcwCompatGuard = true;
})();
