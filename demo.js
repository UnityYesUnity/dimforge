const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL is not supported in this browser.');
}

// Define a utility function to create a shader
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shader:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

// Define a utility function to create a program from vertex and fragment shaders
function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program:', gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// Particle class
class Particle {
    constructor(mass, position, velocity) {
        this.mass = mass;
        this.position = position;
        this.velocity = velocity;
        this.acceleration = { x: 0, y: 0, z: 0 };
    }
}

// RigidBody class
class RigidBody {
    constructor() {
        this.particles = [];
    }

    addParticle(particle) {
        this.particles.push(particle);
    }
}

// Shader sources
const vertexShaderSource = `
    attribute vec3 a_position;
    uniform mat4 u_modelViewProjectionMatrix;

    void main() {
        gl_Position = u_modelViewProjectionMatrix * vec4(a_position, 1.0);
        gl_PointSize = 4.0; // Adjust point size as needed
    }
`;

const fragmentShaderSource = `
    precision mediump float;

    uniform vec4 u_color;

    void main() {
        gl_FragColor = u_color;
    }
`;

// Compile shaders
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

// Create program
const program = createProgram(gl, vertexShader, fragmentShader);

// Get attribute and uniform locations
const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
const colorUniformLocation = gl.getUniformLocation(program, 'u_color');

// Set up the WebGL buffers
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

// Simple collision detection function (sphere-sphere collision)
function detectCollisions() {
    for (let i = 0; i < physicsEngine.particles.length - 1; i++) {
        const particle1 = physicsEngine.particles[i];

        for (let j = i + 1; j < physicsEngine.particles.length; j++) {
            const particle2 = physicsEngine.particles[j];

            // Calculate the distance between particles
            const dx = particle2.position.x - particle1.position.x;
            const dy = particle2.position.y - particle1.position.y;
            const dz = particle2.position.z - particle1.position.z;
            const distanceSquared = dx * dx + dy * dy + dz * dz;
            const radiusSum = Math.sqrt(particle1.mass) + Math.sqrt(particle2.mass);

            // Check for collision and apply simple response
            if (distanceSquared < radiusSum * radiusSum) {
                const normalX = dx / Math.sqrt(distanceSquared);
                const normalY = dy / Math.sqrt(distanceSquared);
                const normalZ = dz / Math.sqrt(distanceSquared);

                // Separate particles to avoid overlapping
                const separation = radiusSum - Math.sqrt(distanceSquared);
                const totalMass = particle1.mass + particle2.mass;
                const ratio1 = particle2.mass / totalMass;
                const ratio2 = particle1.mass / totalMass;

                particle1.position.x -= normalX * separation * ratio1;
                particle1.position.y -= normalY * separation * ratio1;
                particle1.position.z -= normalZ * separation * ratio1;

                particle2.position.x += normalX * separation * ratio2;
                particle2.position.y += normalY * separation * ratio2;
                particle2.position.z += normalZ * separation * ratio2;

                // Simple bounce (reversing velocity component perpendicular to the collision normal)
                const dotProduct = particle1.velocity.x * normalX + particle1.velocity.y * normalY + particle1.velocity.z * normalZ;
                particle1.velocity.x -= 2 * dotProduct * normalX;
                particle1.velocity.y -= 2 * dotProduct * normalY;
                particle1.velocity.z -= 2 * dotProduct * normalZ;

                const dotProduct2 = particle2.velocity.x * normalX + particle2.velocity.y * normalY + particle2.velocity.z * normalZ;
                particle2.velocity.x -= 2 * dotProduct2 * normalX;
                particle2.velocity.y -= 2 * dotProduct2 * normalY;
                particle2.velocity.z -= 2 * dotProduct2 * normalZ;
            }
        }
    }
}

// Physics update function
function updatePhysics() {
    const gravity = { x: 0, y: -9.81, z: 0 }; // Gravity in m/s^2

    // Update particle positions and velocities based on physics simulation
    for (const particle of physicsEngine.particles) {
        // Apply gravity
        particle.acceleration.x = gravity.x;
        particle.acceleration.y = gravity.y;
        particle.acceleration.z = gravity.z;

        // Update velocity
        particle.velocity.x += particle.acceleration.x * 0.016; // Time step of 16ms (60 FPS)
        particle.velocity.y += particle.acceleration.y * 0.016;
        particle.velocity.z += particle.acceleration.z * 0.016;

        // Update position
        particle.position.x += particle.velocity.x * 0.016;
        particle.position.y += particle.velocity.y * 0.016;
        particle.position.z += particle.velocity.z * 0.016;
    }

    // Detect and resolve collisions
    detectCollisions();
}

// Rendering function
function render() {
    // Set the color uniform (white)
    gl.uniform4f(colorUniformLocation, 1.0, 1.0, 1.0, 1.0);

    // Clear the canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Bind the position buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Enable the position attribute
    gl.enableVertexAttribArray(positionAttributeLocation);

    // Tell the position attribute how to get data out of the positionBuffer (3 floats per vertex)
    gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, 0, 0);

    // Update the vertex positions based on particle positions
    const positions = physicsEngine.particles.flatMap(particle => [particle.position.x, particle.position.y, particle.position.z]);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW); // Use DYNAMIC_DRAW for frequent updates

    // Draw the particles as points (use gl.POINTS for this)
    gl.drawArrays(gl.POINTS, 0, physicsEngine.particles.length);

    // Set the color uniform (green)
    gl.uniform4f(colorUniformLocation, 0.0, 1.0, 0.0, 1.0);

    // Draw the rigid bodies as lines (use gl.LINES for this)
    for (const rigidBody of physicsEngine.rigidBodies) {
        const particlePositions = rigidBody.particles.flatMap(particle => [particle.position.x, particle.position.y, particle.position.z]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(particlePositions), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.LINES, 0, rigidBody.particles.length);
    }

    // Disable the position attribute
    gl.disableVertexAttribArray(positionAttributeLocation);

    // Request the next animation frame
    requestAnimationFrame(render);
}

// Initialize the physics engine
const physicsEngine = {
    particles: [],
    rigidBodies: [],
};

function init() {
    // Create some particles and rigid bodies for testing
    const particle1 = new Particle(1.0, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const particle2 = new Particle(2.0, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 });
    const rigidBody1 = new RigidBody();
    rigidBody1.addParticle(particle1);
    rigidBody1.addParticle(particle2);

    const particle3 = new Particle(0.5, { x: -1, y: 1, z: 0 }, { x: 2, y: 0, z: 0 });
    const particle4 = new Particle(1.5, { x: 1, y: 2, z: 0 }, { x: 0, y: -1, z: 0 });
    const rigidBody2 = new RigidBody();
    rigidBody2.addParticle(particle3);
    rigidBody2.addParticle(particle4);

    // Add particles and rigid bodies to the physics engine
    physicsEngine.particles.push(particle1, particle2, particle3, particle4);
    physicsEngine.rigidBodies.push(rigidBody1, rigidBody2);

    // Start the rendering loop
    render();
}

init();
