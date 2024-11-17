// static/script.js
const API_URL = '';  // Empty string since we're serving from same origin

async function login() {
    const nameInput = document.getElementById('name').value;
    const codeInput = document.getElementById('code').value;
    const errorMessage = document.querySelector('.error-message');
    const loginForm = document.querySelector('.login-form');
    const wheelContainer = document.querySelector('.wheel-container');

    try {
        const response = await fetch(`${API_URL}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                name: nameInput,
                code: codeInput
            })
        });

        const data = await response.json();

        if (data.success) {
            errorMessage.style.display = 'none';
            loginForm.style.display = 'none';
            wheelContainer.style.display = 'block';
            initializeWheel();
        } else {
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.style.display = 'block';
    }
}

async function initializeWheel() {
    try {
        const namesResponse = await fetch(`${API_URL}/api/names`, {
            credentials: 'include'
        });
        const namesData = await namesResponse.json();
        const eligibleNames = namesData.names;
        
        // Create wheel sections
        const wheel = document.getElementById('wheel');
        const sectionAngle = 360 / eligibleNames.length;
        
        wheel.innerHTML = '';
        eligibleNames.forEach((name, index) => {
            const section = document.createElement('div');
            section.className = 'wheel-section';
            section.style.transform = `rotate(${index * sectionAngle}deg)`;
            section.style.backgroundColor = `hsl(${index * (360 / eligibleNames.length)}, 70%, 45%)`;
            section.textContent = name;
            wheel.appendChild(section);
        });

        // Spin the wheel and get assignment
        spinWheel(eligibleNames);
    } catch (error) {
        console.error('Error initializing wheel:', error);
    }
}

async function spinWheel(eligibleNames) {
    try {
        const response = await fetch(`${API_URL}/api/secret-santa`, {
            credentials: 'include'
        });
        const data = await response.json();
        
        if (data.recipient) {
            const wheel = document.getElementById('wheel');
            const nameIndex = eligibleNames.indexOf(data.recipient);
            const sectionAngle = 360 / eligibleNames.length;
            const randomRotations = 5 + Math.random() * 5;
            const finalAngle = (randomRotations * 360) + (nameIndex * sectionAngle);
            
            wheel.style.transform = `rotate(${finalAngle}deg)`;
            
            setTimeout(() => {
                document.getElementById('result').textContent = data.recipient;
                document.querySelector('.success-message').style.display = 'block';
            }, 4000);
        }
    } catch (error) {
        console.error('Error getting Secret Santa assignment:', error);
    }
}

// Create snowflake effect
function createSnowflakes() {
    const snowflake = document.createElement('div');
    snowflake.classList.add('snowflake');
    snowflake.innerHTML = '❄';
    snowflake.style.left = Math.random() * 100 + 'vw';
    snowflake.style.animationDuration = Math.random() * 3 + 2 + 's';
    document.body.appendChild(snowflake);

    snowflake.addEventListener('animationend', () => {
        snowflake.remove();
    });
}

setInterval(createSnowflakes, 200);