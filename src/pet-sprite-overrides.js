(function installMongoVelociraptorPetSprite() {
  if (typeof PET_DEFINITIONS === "undefined" || !PET_DEFINITIONS.small_velociraptor) return;

  const mongoDef = PET_DEFINITIONS.small_velociraptor;
  mongoDef.displayName = "Mongo";
  mongoDef.name = "Mongo";
  mongoDef.description = "A small feathered velociraptor with blue and red plumage, big golden eyes, and murder-chicken confidence.";
  mongoDef.sprite = {
    key: "small_velociraptor",
    src: "./assets/sprites/pets/small_velociraptor.png",
    frameWidth: 64,
    frameHeight: 64,
    columns: 3,
    rows: 4,
    idleFrame: 1,
    sequence: [0, 1, 2, 1],
    animationSpeed: 8,
    renderWidth: 48,
    renderHeight: 48,
    directionRows: { down: 0, up: 1, left: 2, right: 3 }
  };
})();
