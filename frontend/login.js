/* Login interface only. Authentication is supplied by the backend teammate. */
"use strict";
const form=document.getElementById("login-form");
const email=document.getElementById("email");
const password=document.getElementById("password");
const toggle=document.getElementById("toggle-password");
const submit=document.getElementById("login-submit");
const message=document.getElementById("form-message");
const emailError=document.getElementById("email-error");
const passwordError=document.getElementById("password-error");
// Set only after the backend teammate confirms the exact endpoint and payload.
const LOGIN_API_URL="";
function fieldError(input,node,text){node.textContent=text;input.setAttribute("aria-invalid",text?"true":"false")}
function clearErrors(){fieldError(email,emailError,"");fieldError(password,passwordError,"");message.textContent="";message.className="message"}
function validate(){let ok=true;const value=email.value.trim();if(!value){fieldError(email,emailError,"Enter your email address.");ok=false}else if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)){fieldError(email,emailError,"Enter a valid email address.");ok=false}else fieldError(email,emailError,"");if(!password.value){fieldError(password,passwordError,"Enter your password.");ok=false}else fieldError(password,passwordError,"");return ok}
toggle.addEventListener("click",()=>{const visible=password.type==="text";password.type=visible?"password":"text";toggle.textContent=visible?"Show":"Hide";toggle.setAttribute("aria-pressed",String(!visible))});
[email,password].forEach(input=>input.addEventListener("input",()=>{if(input===email)fieldError(email,emailError,"");if(input===password)fieldError(password,passwordError,"");message.textContent="";message.className="message"}));
form.addEventListener("submit",async event=>{event.preventDefault();clearErrors();if(!validate())return;if(!LOGIN_API_URL){message.className="message info";message.textContent="The form is ready. Sign-in will be enabled after the authentication API is connected.";return}submit.disabled=true;submit.querySelector(".button-label").textContent="Signing in…";try{const response=await fetch(LOGIN_API_URL,{method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",body:JSON.stringify({email:email.value.trim(),password:password.value})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.message||"Sign-in failed. Check your details and try again.");message.className="message info";message.textContent="Server accepted the request. Session handling and role-based redirect need to be connected to the agreed API contract."}catch(error){message.textContent=error.message||"Unable to sign in right now. Please try again."}finally{submit.disabled=false;submit.querySelector(".button-label").textContent="Sign in"}});
