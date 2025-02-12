/*
 * Class representing a feedforward neural network.
 * Expects weights to be an array of matrices (2D arrays)
 * and biases to be an array of vectors.
 */
class NeuralNetwork {
  constructor(weights, biases) {
    this.weights = weights; // e.g. [ [ [w11, w12, ...], [w21, w22, ...], ... ], ... ]
    this.biases = biases; // e.g. [ [b1, b2, ...], ... ]
  }

  // Sigmoid activation function.
  activate(x) {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Predict the output of the neural network given an input vector.
   * Uses explicit loops to compute the dot product of weights and inputs.
   *
   * @param {number[]} inputVector - The input vector to the network.
   * @returns {number[]} - The output vector after processing through the network.
   */
  predict(inputVector) {
    let output = inputVector;

    // For each layer of the network...
    for (let layer = 0; layer < this.weights.length; layer++) {
      const weightMatrix = this.weights[layer]; // 2D array: each row corresponds to a neuron
      const biasVector = this.biases[layer]; // 1D array: one bias per neuron
      let nextOutput = [];

      // For each neuron in the current layer:
      for (let neuron = 0; neuron < weightMatrix.length; neuron++) {
        const weightsForNeuron = weightMatrix[neuron]; // Array of weights for this neuron
        let sum = 0;

        // Compute the dot product of the weights and the current output vector.
        for (let j = 0; j < weightsForNeuron.length; j++) {
          sum += weightsForNeuron[j] * output[j];
        }

        // Add the bias for this neuron.
        sum += biasVector[neuron];

        // Apply the activation function.
        nextOutput.push(this.activate(sum));
      }

      // Prepare for the next layer.
      output = nextOutput;
    }

    return output;
  }


  // Compute softmax probabilities for the output vector.
  softmax(values) {
    // For numerical stability, subtract the max value.
    const maxVal = Math.max(...values);
    const expValues = values.map(v => Math.exp(v - maxVal));
    const sumExp = expValues.reduce((sum, v) => sum + v, 0);
    return expValues.map(v => v / sumExp);
  }

  // Sample an index based on the probabilities.
  sampleIndex(probabilities) {
    let r = Math.random();
    for (let i = 0; i < probabilities.length; i++) {
      r -= probabilities[i];
      if (r <= 0) {
        return i;
      }
    }
    return probabilities.length - 1; // Fallback
  }
}

// Global adjustable parameters.
const params = {
  antLifespan: 500, // Ticks before an adult becomes "old"
  antDensity: 50, // Initial number of ants
  maxAnts: 200, // Maximum number of ants allowed in the simulation
  maxAntHealth: 100,
  foodDensity: 0.05, // Chance that a new grid cell is food
  terrainDensity: 0.05, // Chance that a new grid cell is terrain
  eggToAdultTicks: 50, // Ticks for an egg to hatch
  foodSpawnInterval: 100, // Every X ticks, new food is spawned
  foodSpawnCount: 5, // Number of food cells to add per spawn event
  genomeNoise: 0.1 // Amount of mutation to genome during sexual reproduction
};

// Global variable to hold a seed genome (if adopted).
let seedGenome = null;

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
  constructor(x, y, neuralNetwork = null, stage = null) {
    this.x = x; // Position on the grid
    this.y = y;
    this.age = 0;
    this.health = 100;
    this.stage = stage != null ? stage : "egg"; // "egg", "adult", "old"
    this.stageAge = 0;
    this.id = crypto.randomUUID(); // Unique identifier

    // Neural network initialization (inherit or random)
    if (neuralNetwork) {
      // console.log(neuralNetwork.weights);
      // let weights = neuralNetwork.weights.map((value) => value + (Math.random() - 0.5) * 0.1);
      // let biases = neuralNetwork.biases.map((value) => value + (Math.random() - 0.5) * 0.1);
      this.neuralNetwork = neuralNetwork;
    } else {
      this.neuralNetwork = new NeuralNetwork(
          this.randomWeights(),
          this.randomBiases(),
      );
    }

    // Genetic similarity affects color
    this.baseColor = this.calculateColorFromNN();
  }

  randomWeights() {
    return Array.from({ length: 3 }, () =>
        Array(10)
            .fill()
            .map(() => Math.random() * 2 - 1),
    );
  }

  randomBiases() {
    return Array.from({ length: 3 }, () =>
        Array(10)
            .fill()
            .map(() => Math.random() * 2 - 1),
    );
  }

  calculateColorFromNN() {
    if (!this.neuralNetwork) {
      return "rgb(0,0,0)";
    }

    const sampledValues = [];

    // Sample first element of each weight matrix (handles both 1D and 2D)
    for (const weightMatrix of this.neuralNetwork.weights) {
      if (weightMatrix.length > 0) {
        if (Array.isArray(weightMatrix[0])) {
          // 2D matrix: take first element of the first row
          sampledValues.push(weightMatrix[0][0]);
        } else {
          // 1D array: take first element
          sampledValues.push(weightMatrix[0]);
        }
      }
    }

    // Sample first element of each bias vector
    for (const biasVector of this.neuralNetwork.biases) {
      if (biasVector.length > 0) {
        sampledValues.push(biasVector[0]);
      }
    }

    let r = 0,
        g = 0,
        b = 0;
    for (let i = 0; i < sampledValues.length; i++) {
      const value = sampledValues[i];
      switch (i % 3) {
        case 0:
          r += value;
          break;
        case 1:
          g += value;
          break;
        case 2:
          b += value;
          break;
      }
    }

    // Ensure RGB values are within 0-255
    const clamp = (val) => Math.abs((val * 256) % 256);
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  }
  /**
   * Converts the ant's local surroundings directly into a numerical input vector.
   * This version combines "getVision" and "processVision" for efficiency.
   *
   * @param {Object} simulation - The simulation instance containing the getCell(x, y) method.
   * @returns {number[]} - The input vector for the neural network.
   */
  processVision(simulation) {
    const visionRange = 1; // Look at a 3x3 grid around the ant.
    const size = (visionRange * 2 + 1) ** 2;
    const inputVector = new Array(size);
    let index = 0;

    for (let dy = -visionRange; dy <= visionRange; dy++) {
      for (let dx = -visionRange; dx <= visionRange; dx++) {
        const cell = simulation.getCell(this.x + dx, this.y + dy);
        const ant = simulation.getAntAt(this.x + dx, this.y + dy);

        // Map cell type to a numeric value:
        // For example, food=1, terrain=-1, ant=0.5, empty=0.
        let value = 0;
        if (ant != null) {
          value = 2;
        } else if (cell === "food") {
          value = 1;
        } else if (cell === "terrain") {
          value = 0;
        } else if (cell === "empty") {
          value = -1;
        }

        inputVector[index++] = value;
      }
    }
    return inputVector;
  }

  decideAction(simulation) {
    if (this.stage === "egg") return "none";

    //let vision = getVision(simulation); // Get surrounding pixels
    let inputVector = this.processVision(simulation); // Convert to NN input
    let outputVector = this.neuralNetwork.predict(inputVector); // Compute outputs

    console.log("id: " + this.id + ": inputVector: " + inputVector);
    console.log("id: " + this.id + ": outputVector: " + outputVector);

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

    const probabilities = this.neuralNetwork.softmax(outputVector);
    let chosenIndex = this.neuralNetwork.sampleIndex(probabilities);
    console.log(
        "id: " +
        this.id +
        "chosen action = " +
        actions[chosenIndex % actions.length] +
        "chosen index = " + chosenIndex +
        "outputVector = " + outputVector +
        "inputVector = " + inputVector
    );
    return actions[chosenIndex % actions.length]; // Return corresponding action
  }

  processAction(action, simulation) {
    console.log("processing action" + action);
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

    switch (action) {
      case "attack": {
        const target =
            simulation.getAntAt(this.x, this.y - 1) ||
            simulation.getAntAt(this.x, this.y + 1) ||
            simulation.getAntAt(this.x - 1, this.y) ||
            simulation.getAntAt(this.x + 1, this.y);
        if (target && target.stage === 'egg') {
          target.health -= 50;
          this.health = Math.min(params.maxAntHealth, this.health + 20);
        }
        else if (target) target.health -= 10;
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
          egg.neuralNetwork = new NeuralNetwork(
              this.neuralNetwork.weights,
              this.neuralNetwork.biases,
          );
          egg.baseColor = egg.calculateColorFromNN();
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
        seedGenome,
        'adult'
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
          let offspringWeights = [];
          let offspringBiases = [];

          // Combine weights and biases from both parents
          for (let i = 0; i < ant.neuralNetwork.weights.length; i++) {
            offspringWeights.push(
              i % 2 === 0
                ? ant.neuralNetwork.weights[i]
                : partner.neuralNetwork.weights[i],
            );
            offspringBiases.push(
              i % 2 === 0
                ? ant.neuralNetwork.biases[i]
                : partner.neuralNetwork.biases[i],
            );
          }

           // Apply small mutation to encourage diversity
          offspringWeights = offspringWeights.map(layer =>
              layer.map(value => value + (Math.random() - 0.5) * params.genomeNoise)
          );
          offspringBiases = offspringBiases.map(layer =>
              layer.map(value => value + (Math.random() - 0.5) * params.genomeNoise)
          );

          // Create the new ant with inherited and mutated neural network
          const egg = new Ant(
            ant.x,
            ant.y,
            new NeuralNetwork(offspringWeights, offspringBiases),
          );

          egg.baseColor = egg.calculateColorFromNN();
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
      ant.health -= 1;
      if (ant.stage === "egg" && ant.stageAge >= params.eggToAdultTicks) {
        ant.stage = "adult";
        ant.health = 100;
      }
      if (ant.stage === "adult" && ant.age >= params.antLifespan + (Math.random() - 0.5) * 0.05) {
        ant.stage = "old";
      }
    }
    this.ants = this.ants.filter((ant) => ant.health > 0);
    this.ants = this.ants.filter((ant) => ant.stage !== "old");
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
  // Determine the visible grid boundaries:
  const left = Math.floor(camera.x / cellSize);
  const top = Math.floor(camera.y / cellSize);
  const right = Math.floor((camera.x + canvas.width) / cellSize);
  const bottom = Math.floor((camera.y + canvas.height) / cellSize);

  // Spawn food at random positions within the visible area:
  for (let i = 0; i < params.foodSpawnCount; i++) {
    const foodX = Math.floor(Math.random() * (right - left + 1)) + left;
    const foodY = Math.floor(Math.random() * (bottom - top + 1)) + top;
    simulation.grid.set(`${foodX},${foodY}`, "food");
  }
}

// Update simulation stats in the Stats drawer.
function updateStats() {
  const total = simulation.ants.length;
  const eggs = simulation.ants.filter((a) => a.stage === "egg").length;
  const adults = simulation.ants.filter((a) => a.stage === "adult").length;
  const statsHTML = `
    <p><strong>Total Ants:</strong> ${total}</p>
    <p><strong>Eggs:</strong> ${eggs}</p>
    <p><strong>Adults:</strong> ${adults}</p>
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
    <p><strong>Neural Network:</strong> [  ${[
      ...ant.neuralNetwork.weights.flat(2), // Flatten weights
      ...ant.neuralNetwork.biases.flat(2), // Flatten biases
    ]
      .map((n) => n.toFixed(2)) // Format each value
      .join(", ")}]</p>
  `;
  infoBox.style.display = "block";
}
document.getElementById("adoptGenome").addEventListener("click", () => {
  if (currentSelectedAnt) {
    seedGenome = currentSelectedAnt.neuralNetwork;
    simulation = new Simulation();
    document.getElementById("infoBox").style.display = "none";
  }
});

// TODO // Build a URL with the ant’s genome encoded and copy to clipboard.
// document.getElementById("copyGenome").addEventListener("click", () => {
//   if (currentSelectedAnt) {
//     const weightsStr = currentSelectedAnt.neuralNetwork.weights.join(",");
//     const biasesStr = currentSelectedAnt.neuralNetwork.biases.join(",");
//     const baseUrl = window.location.href.split("?")[0];
//     const newUrl = `${baseUrl}?weights=${encodeURIComponent(weightsStr)}&biases=${biasesStr}`;
//     navigator.clipboard.writeText(newUrl).then(() => {
//       document.getElementById("copyGenome").textContent = "Copied!";
//       setTimeout(() => {
//         document.getElementById("copyGenome").textContent = "Copy Link";
//       }, 2000);
//     });
//   }
// });
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

window.addEventListener('load', function() {
  console.log("Window loaded. Checking for seed parameters...");

  const urlParams = new URLSearchParams(window.location.search);
  const weightsParam = urlParams.get("weights");
  const biasesParam = urlParams.get("biases");

  console.log("Weights parameter:", weightsParam);
  console.log("Biases parameter:", biasesParam);

  if (weightsParam && biasesParam) {
    const weightsArray = weightsParam.split(",").map(Number);
    const biasesArray = biasesParam.split(",").map(Number);

    console.log("Parsed weights:", weightsArray);
    console.log("Parsed biases:", biasesArray);

    if (weightsArray.every(n => !isNaN(n)) && biasesArray.every(n => !isNaN(n))) {
      // Assuming your NeuralNetwork constructor accepts weights and biases arrays.
      seedGenome = new NeuralNetwork(weightsArray, biasesArray);
      simulation = new Simulation();
      console.log("Seed genome set successfully:", seedGenome);
    } else {
      console.error("Invalid numeric values found in URL parameters.");
    }
  } else {
    console.log("No seed parameters provided in URL.");
  }
});
