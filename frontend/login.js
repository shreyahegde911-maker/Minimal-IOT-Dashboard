"use strict";

const form = document.getElementById("login-form");
const email = document.getElementById("email");
const password = document.getElementById("password");
const toggle = document.getElementById("toggle-password");
const submit = document.getElementById("login-submit");
const message = document.getElementById("form-message");
const emailError = document.getElementById("email-error");
const passwordError = document.getElementById("password-error");

function fieldError(input, node, text) {
  node.textContent = text;
  input.setAttribute("aria-invalid", text ? "true" : "false");
}

function clearErrors() {
  fieldError(email, emailError, "");
  fieldError(password, passwordError, "");
  message.textContent = "";
  message.className = "message";
}

function validate() {
  let valid = true;
  const value = email.value.trim();

  if (!value) {
    fieldError(email, emailError, "Enter your email address.");
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    fieldError(email, emailError, "Enter a valid email address.");
    valid = false;
  } else {
    fieldError(email, emailError, "");
  }

  if (!password.value) {
    fieldError(password, passwordError, "Enter your password.");
    valid = false;
  } else {
    fieldError(password, passwordError, "");
  }

  return valid;
}

toggle.addEventListener("click", () => {
  const show = password.type === "password";
  password.type = show ? "text" : "password";
  toggle.textContent = show ? "Hide" : "Show";
  toggle.setAttribute("aria-pressed", String(show));
});

[email, password].forEach(input => {
  input.addEventListener("input", () => {
    if (input === email) fieldError(email, emailError, "");
    if (input === password) fieldError(password, passwordError, "");
    message.textContent = "";
    message.className = "message";
  });
});

form.addEventListener("submit", event => {
  event.preventDefault();
  clearErrors();

  if (!validate()) return;

  message.className = "message info";
  message.textContent =
    "Your details passed validation. Sign-in is not connected yet; please wait for authentication integration.";
});

