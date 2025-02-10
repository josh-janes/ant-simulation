// simulation.js

// Global adjustable parameters.
const params = {
  antLifespan: 500, // Ticks before an adult becomes "old"
  antDensity: 50, // Initial number of ants
  maxAnts: 200, // Maximum number of ants allowed in the simulation
  foodDensity: 0.05, // Chance that a new grid cell is food
  terrainDensity: 0.05, // Chance that a new grid cell is terrain
  eggToAdultTicks: 50, // Ticks for an egg to hatch
  foodSpawnInterval: 100, // Every X ticks, new food is spawned
  foodSpawnCount: 5, // Number of food cells to add per spawn event
};

// Global variable to hold a seed genome (if adopted).
let seedGenome = null;
// Mutation noise factor.
const genomeNoiseLevel = 0.1;

// Check URL parameters for a seed.
const urlParams = new URLSearchParams(window.location.search);
const seedParam = urlParams.get("seed");
if (seedParam) {
  const seedArray = seedParam.split(",").map(Number);
  if (seedArray.length === 10 && seedArray.every((n) => !isNaN(n))) {
    seedGenome = seedArray;
  }
}

// Helper function to mutate a genome.
function mutateGenome(base, noiseLevel) {
  return base.map((val) => {
    let noise = (Math.random() * 2 - 1) * noiseLevel;
    let newVal = val + noise;
    return Math.min(Math.max(newVal, 0), 1);
  });
}

// Get canvas and context.
const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");

// Resize canvas to fill the screen.
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// Simulation settings.
let simulationSpeed = 30; // ticks per second
let cellSize = 10; // size of each simulation cell (pixels)

// Camera parameters for panning.
let camera = { x: 0, y: 0 };
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  dragStart.x = e.clientX;
  dragStart.y = e.clientY;
  cameraStart.x = camera.x;
  cameraStart.y = camera.y;
});
canvas.addEventListener("mousemove", (e) => {
  if (isDragging) {
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    camera.x = cameraStart.x - dx;
    camera.y = cameraStart.y - dy;
  }
});
canvas.addEventListener("mouseup", () => {
  isDragging = false;
});
canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

/**
 * Class representing an ant.
 */
class Ant {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.health = 100;
    this.age = 0; // Overall ticks alive
    this.stage = "adult"; // "egg", "adult", or "old"
    this.stageAge = 0; // Ticks spent in the current stage

    // Use the seed genome if available (with mutation) or generate randomly.
    if (seedGenome !== null) {
      this.neuralNetwork = mutateGenome(seedGenome, genomeNoiseLevel);
    } else {
      this.neuralNetwork = [];
      for (let i = 0; i < 10; i++) {
        this.neuralNetwork.push(Math.random());
      }
    }
    this.baseColor = this.computeColorFromNN();
    this.nextAction = "none";
  }

  computeColorFromNN() {
    const r = Math.floor(this.neuralNetwork[0] * 255);
    const g = Math.floor(this.neuralNetwork[1] * 255);
    const b = Math.floor(this.neuralNetwork[2] * 255);
    return `rgb(${r},${g},${b})`;
  }

  decideAction(simulation) {
    if (this.stage === "egg") return "none";
    let actions =
      this.stage === "adult"
        ? [
            "up",
            "down",
            "left",
            "right",
            "attack",
            "eat",
            "sleep",
            "mate",
            "asexual",
          ]
        : ["attack", "eat", "sleep"];
    return actions[Math.floor(Math.random() * actions.length)];
  }

  processAction(action, simulation) {
    // For movement, compute target cell and check for terrain.
    if (["up", "down", "left", "right"].includes(action)) {
      let newX = this.x,
        newY = this.y;
      if (action === "up") newY = this.y - 1;
      if (action === "down") newY = this.y + 1;
      if (action === "left") newX = this.x - 1;
      if (action === "right") newX = this.x + 1;
      // If the destination cell is terrain, do not move.
      if (simulation.getCell(newX, newY) === "terrain") {
        // Movement blocked.
        return;
      } else {
        this.x = newX;
        this.y = newY;
        return;
      }
    }
    // If the ant is old and tries to move, ignore movement.
    if (
      this.stage === "old" &&
      ["up", "down", "left", "right"].includes(action)
    )
      return;
    switch (action) {
      case "attack": {
        const target =
          simulation.getAntAt(this.x, this.y - 1) ||
          simulation.getAntAt(this.x, this.y + 1) ||
          simulation.getAntAt(this.x - 1, this.y) ||
          simulation.getAntAt(this.x + 1, this.y);
        if (target) target.health -= 10;
        break;
      }
      case "eat": {
        const cell = simulation.getCell(this.x, this.y);
        if (cell === "food") {
          this.health = Math.min(100, this.health + 20);
          simulation.clearCell(this.x, this.y);
        }
        break;
      }
      case "sleep":
        this.health = Math.min(100, this.health + 5);
        break;
      case "asexual": {
        if (simulation.ants.length < params.maxAnts) {
          this.health /= 2;
          const egg = new Ant(this.x, this.y);
          egg.neuralNetwork = [...this.neuralNetwork];
          egg.baseColor = egg.computeColorFromNN();
          egg.stage = "egg";
          egg.stageAge = 0;
          egg.health = 50;
          simulation.ants.push(egg);
        }
        break;
      }
      default:
        break;
    }
  }
}

/**
 * The Simulation class.
 */
class Simulation {
  constructor() {
    this.ants = [];
    this.grid = new Map();
    for (let i = 0; i < params.antDensity; i++) {
      const ant = new Ant(
        Math.floor(Math.random() * 100 - 50),
        Math.floor(Math.random() * 100 - 50),
      );
      this.ants.push(ant);
    }
  }

  getCell(x, y) {
    const key = `${x},${y}`;
    if (!this.grid.has(key)) {
      const rand = Math.random();
      let cellType = "empty";
      if (rand < params.foodDensity) {
        cellType = "food";
      } else if (rand < params.foodDensity + params.terrainDensity) {
        cellType = "terrain";
      }
      this.grid.set(key, cellType);
    }
    return this.grid.get(key);
  }

  clearCell(x, y) {
    this.grid.set(`${x},${y}`, "empty");
  }

  getAntAt(x, y) {
    return this.ants.find((ant) => ant.x === x && ant.y === y);
  }

  update() {
    // Phase 1: Decide actions.
    for (const ant of this.ants) {
      ant.nextAction = ant.decideAction(this);
    }

    // Phase 2: Process mating.
    const matedAnts = new Set();
    for (const ant of this.ants) {
      if (
        ant.nextAction === "mate" &&
        ant.stage === "adult" &&
        !matedAnts.has(ant)
      ) {
        const neighbors = [
          { x: ant.x, y: ant.y - 1 },
          { x: ant.x, y: ant.y + 1 },
          { x: ant.x - 1, y: ant.y },
          { x: ant.x + 1, y: ant.y },
        ];
        let partner = null;
        for (const n of neighbors) {
          const other = this.getAntAt(n.x, n.y);
          if (
            other &&
            other.nextAction === "mate" &&
            other.stage === "adult" &&
            !matedAnts.has(other)
          ) {
            partner = other;
            break;
          }
        }
        if (partner && this.ants.length < params.maxAnts) {
          const offspringNN = [];
          for (let i = 0; i < 10; i++) {
            offspringNN.push(
              i < 5 ? ant.neuralNetwork[i] : partner.neuralNetwork[i],
            );
          }
          const egg = new Ant(ant.x, ant.y);
          egg.neuralNetwork = offspringNN;
          egg.baseColor = egg.computeColorFromNN();
          egg.stage = "egg";
          egg.stageAge = 0;
          egg.health = 50;
          this.ants.push(egg);
          matedAnts.add(ant);
          matedAnts.add(partner);
        }
      }
    }

    // Phase 3: Process non-mating actions and update ages.
    for (const ant of this.ants) {
      if (ant.nextAction !== "mate") {
        ant.processAction(ant.nextAction, this);
      }
      ant.age++;
      ant.stageAge++;
      if (ant.stage === "egg" && ant.stageAge >= params.eggToAdultTicks) {
        ant.stage = "adult";
        ant.health = 100;
      }
      if (ant.stage === "adult" && ant.age >= params.antLifespan) {
        ant.stage = "old";
      }
    }
    this.ants = this.ants.filter((ant) => ant.health > 0);
  }

  render() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cols = Math.ceil(canvas.width / cellSize);
    const rows = Math.ceil(canvas.height / cellSize);
    const startX = Math.floor(camera.x / cellSize) - 1;
    const startY = Math.floor(camera.y / cellSize) - 1;
    for (let i = 0; i <= cols + 2; i++) {
      for (let j = 0; j <= rows + 2; j++) {
        const gridX = startX + i;
        const gridY = startY + j;
        const cell = this.getCell(gridX, gridY);
        ctx.fillStyle =
          cell === "terrain" ? "#654321" : cell === "food" ? "#00FF00" : "#222";
        const screenX = gridX * cellSize - camera.x;
        const screenY = gridY * cellSize - camera.y;
        ctx.fillRect(screenX, screenY, cellSize, cellSize);
      }
    }
    for (const ant of this.ants) {
      const screenX = ant.x * cellSize - camera.x;
      const screenY = ant.y * cellSize - camera.y;
      if (ant.stage === "egg") {
        ctx.fillStyle = "#fff";
        ctx.fillRect(screenX, screenY, cellSize, cellSize);
      } else if (ant.stage === "old") {
        ctx.fillStyle = ant.baseColor;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(screenX, screenY, cellSize, cellSize);
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = ant.baseColor;
        ctx.fillRect(screenX, screenY, cellSize, cellSize);
      }
    }
  }
}

// Create a new simulation.
let simulation = new Simulation();

// Global tick counter for food spawning.
let tickCount = 0;
function spawnFood() {
  const centerX = Math.floor((camera.x + canvas.width / 2) / cellSize);
  const centerY = Math.floor((camera.y + canvas.height / 2) / cellSize);
  for (let i = 0; i < params.foodSpawnCount; i++) {
    const offsetX = Math.floor(Math.random() * 21) - 10;
    const offsetY = Math.floor(Math.random() * 21) - 10;
    const foodX = centerX + offsetX;
    const foodY = centerY + offsetY;
    simulation.grid.set(`${foodX},${foodY}`, "food");
  }
}

// Update simulation stats in the Stats drawer.
function updateStats() {
  const total = simulation.ants.length;
  const eggs = simulation.ants.filter((a) => a.stage === "egg").length;
  const adults = simulation.ants.filter((a) => a.stage === "adult").length;
  const olds = simulation.ants.filter((a) => a.stage === "old").length;
  const statsHTML = `
    <p><strong>Total Ants:</strong> ${total}</p>
    <p><strong>Eggs:</strong> ${eggs}</p>
    <p><strong>Adults:</strong> ${adults}</p>
    <p><strong>Old:</strong> ${olds}</p>
  `;
  document.getElementById("statsContent").innerHTML = statsHTML;
}

// Play/Pause control.
let isPaused = false;
document.getElementById("playPauseButton").addEventListener("click", () => {
  isPaused = !isPaused;
  document.getElementById("playPauseButton").textContent = isPaused
    ? "Play"
    : "Pause";
});

// Reset button now resets the simulation with all ants randomized and clears the seed.
document.getElementById("resetButton").addEventListener("click", () => {
  seedGenome = null;
  simulation = new Simulation();
});

// Toggle settings drawer.
const toggleParametersButton = document.getElementById("toggleParameters");
const parametersDiv = document.getElementById("parameters");
toggleParametersButton.addEventListener("click", () => {
  if (parametersDiv.style.display === "none") {
    parametersDiv.style.display = "block";
    toggleParametersButton.textContent = "Hide Parameters";
  } else {
    parametersDiv.style.display = "none";
    toggleParametersButton.textContent = "Show Parameters";
  }
});

// Apply parameters and reset simulation.
document.getElementById("applyParameters").addEventListener("click", () => {
  params.antLifespan = Number(document.getElementById("antLifespan").value);
  params.antDensity = Number(document.getElementById("antDensity").value);
  params.maxAnts = Number(document.getElementById("maxAnts").value);
  params.foodDensity = Number(document.getElementById("foodDensity").value);
  params.terrainDensity = Number(
    document.getElementById("terrainDensity").value,
  );
  params.eggToAdultTicks = Number(
    document.getElementById("eggToAdultTicks").value,
  );
  params.foodSpawnInterval = Number(
    document.getElementById("foodSpawnInterval").value,
  );
  params.foodSpawnCount = Number(
    document.getElementById("foodSpawnCount").value,
  );
  simulation = new Simulation();
});

// About drawer controls.
document.getElementById("aboutButton").addEventListener("click", () => {
  document.getElementById("aboutContent").style.display = "block";
});
document.getElementById("closeAbout").addEventListener("click", () => {
  document.getElementById("aboutContent").style.display = "none";
});

// Stats drawer controls.
document.getElementById("toggleStats").addEventListener("click", () => {
  const statsContent = document.getElementById("statsContent");
  const toggleBtn = document.getElementById("toggleStats");
  if (statsContent.style.display === "none") {
    statsContent.style.display = "block";
    toggleBtn.textContent = "Hide Stats";
  } else {
    statsContent.style.display = "none";
    toggleBtn.textContent = "Show Stats";
  }
});

// Genome adoption: when an ant is clicked, show its info.
let currentSelectedAnt = null;
function showAntInfo(ant) {
  currentSelectedAnt = ant;
  const infoBox = document.getElementById("infoBox");
  const antInfo = document.getElementById("antInfo");
  antInfo.innerHTML = `
    <p><strong>Stage:</strong> ${ant.stage}</p>
    <p><strong>Position:</strong> (${ant.x}, ${ant.y})</p>
    <p><strong>Health:</strong> ${ant.health}</p>
    <p><strong>Age:</strong> ${ant.age}</p>
    <p><strong>Neural Network:</strong> [${ant.neuralNetwork.map((n) => n.toFixed(2)).join(", ")}]</p>
  `;
  infoBox.style.display = "block";
}
document.getElementById("adoptGenome").addEventListener("click", () => {
  if (currentSelectedAnt) {
    seedGenome = [...currentSelectedAnt.neuralNetwork];
    simulation = new Simulation();
    document.getElementById("infoBox").style.display = "none";
  }
});

// New Copy Link button: build a URL with the ant’s genome encoded and copy to clipboard.
document.getElementById("copyGenome").addEventListener("click", () => {
  if (currentSelectedAnt) {
    const genomeStr = currentSelectedAnt.neuralNetwork.join(",");
    const baseUrl = window.location.href.split("?")[0];
    const newUrl = `${baseUrl}?seed=${encodeURIComponent(genomeStr)}`;
    navigator.clipboard.writeText(newUrl).then(() => {
      document.getElementById("copyGenome").textContent = "Copied!";
      setTimeout(() => {
        document.getElementById("copyGenome").textContent = "Copy Link";
      }, 2000);
    });
  }
});
document.getElementById("closeInfo").addEventListener("click", () => {
  document.getElementById("infoBox").style.display = "none";
});

// Simulation speed control.
document.getElementById("simulationSpeed").addEventListener("input", (e) => {
  simulationSpeed = Number(e.target.value);
});

// Main simulation loop.
let lastUpdateTime = Date.now();
function simulationLoop() {
  const now = Date.now();
  const delta = now - lastUpdateTime;
  if (!isPaused && delta > 1000 / simulationSpeed) {
    simulation.update();
    lastUpdateTime = now;
    tickCount++;
    if (tickCount % params.foodSpawnInterval === 0) {
      spawnFood();
    }
  }
  simulation.render();
  updateStats();
  requestAnimationFrame(simulationLoop);
}
simulationLoop();

// Show ant info when clicking on the canvas.
canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const clickX = e.clientX - rect.left + camera.x;
  const clickY = e.clientY - rect.top + camera.y;
  const gridX = Math.floor(clickX / cellSize);
  const gridY = Math.floor(clickY / cellSize);
  const ant = simulation.getAntAt(gridX, gridY);
  if (ant) {
    showAntInfo(ant);
  }
});
