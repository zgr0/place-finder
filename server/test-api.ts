async function testAuth() {
    const email = `SuperTest${Date.now()}@example.com`;
    const password = "password123";

    console.log("1. Registering user with UPPERCASE email:", email);

    const registerRes = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email,
            username: `User${Date.now()}`,
            password,
            factionId: 1
        })
    });

    const registerData = await registerRes.json();
    if (registerRes.ok) {
        console.log("   Registration successful!", registerData);
    } else {
        console.error("   Registration failed:", registerData);
        return;
    }

    const lowercaseEmail = email.toLowerCase();
    console.log("\n2. Logging in with lowercase email:", lowercaseEmail);

    const loginRes = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: lowercaseEmail,
            password
        })
    });

    const loginData = await loginRes.json();
    if (loginRes.ok) {
        console.log("   Login successful! Received user info:", loginData);
    } else {
        console.error("   Login failed:", loginData);
    }
}

testAuth();
