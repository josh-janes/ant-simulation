Ant-Sim: An Interactive Neural Cellular Automata Simulation
==============

Overview
--------

This is a dynamic, neural-network-driven ant simulation that runs in a browser using an HTML5 canvas. The ants navigate and interact within a pixel grid that expands to match the screen size. Their behavior is determined by a neural network, allowing for emergent, evolving behaviors.

Features
--------

-   **Dynamic Pixel Grid:** The world dynamically expands and is procedurally generated.

-   **Neural Network Ants:** Each ant has a simple neural network dictating its behavior.

-   **Actions:** Ants can move, eat, sleep, attack, and reproduce.

-   **Genetics & Evolution:** Ants can reproduce sexually and asexually, inheriting neural network traits from their parents.

-   **Resource System:** Food and terrain elements affect the simulation, and food respawns periodically.

-   **Simulation Controls:** Play/Pause, Reset, and adjustable parameters for fine-tuning.

-   **Statistics Tracking:** View key metrics, including total ants, deaths, and predation counts.

-   **Sharable Neural Networks:** Copy and share an ant's genetic code via a URL parameter.

-   **Expandable UI Panels:** Adjustable settings and simulation stats are available through expandable drawers.

Installation
------------

### Clone the repository:

```
git clone https://github.com/josh-janes/ant-simulation.git
cd ant-simulation
```

### Install dependencies (Node.js required):

```
npm install
```

### Start the server:

```
node server.js
```

### Open a browser and visit:

```
http://localhost:3000
```

Usage
-----

-   **Play/Pause Button:** Toggles the simulation.

-   **Reset Button:** Resets ants with random neural networks.

-   **Stats Drawer:** Displays statistics about the simulation.

-   **About Button:** Opens a panel explaining the simulation.

-   **Adjustable Parameters:** Modify lifespan, food density, terrain density, max ants, etc.

-   **Ant Info Box:** Clicking an ant displays its details, with a 'Copy' button for sharing.

Technologies Used
-----------------

-   **Node.js + Express** (backend server)

-   **HTML5 Canvas** (visualization)

-   **JavaScript (ES6+)** (simulation logic)

Future Enhancements
-------------------

-   Improved neural network training.

-   Additional terrain and environmental challenges.

-   More complex ant interactions and behaviors.

License
-------

This project is licensed under the **MIT License**.
