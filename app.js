document.getElementById('login-form').addEventListener('submit', function(event) {
    event.preventDefault();

    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;
    var errorMessage = document.getElementById('error-message');

    fetch('http://localhost:8032/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username, password: password }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.message === 'Login successful!') {
            alert(data.message);
            // Redirect to another page or perform further actions here
        } else {
            errorMessage.textContent = data.message;
        }
    })
    .catch(error => {
        errorMessage.textContent = 'An error occurred. Please try again.';
    });
});
