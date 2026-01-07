// ========================================
// AUTH.JS - Google + Email Auth
// ========================================

let loginMath = { num1: 0, num2: 0, answer: 0 };
let signupMath = { num1: 0, num2: 0, answer: 0 };
let profileBase64 = null;

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    generateMathCaptcha('login');
    generateMathCaptcha('signup');
});

function initAuth() {
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDatabase) {
            clearInterval(checkFirebase);

            window.firebaseAuth.onAuthStateChanged(async (user) => {
                await updateUI(user);
            });

            initTabs();
            initForms();
        }
    }, 100);

    setTimeout(() => clearInterval(checkFirebase), 5000);
}

// ========================================
// GOOGLE LOGIN (Main)
// ========================================
async function handleGoogleLogin() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const result = await window.firebaseAuth.signInWithPopup(provider);
        const user = result.user;

        showToast('Google Sign-In Successful!', 'success');

        // Create user record if new, generating username from Name
        await ensureUserInDatabase(user);

        setTimeout(() => { window.location.href = 'index.html'; }, 1000);

    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
}

async function ensureUserInDatabase(user) {
    const userRef = window.firebaseDatabase.ref('users/' + user.uid);
    const snapshot = await userRef.once('value');

    if (!snapshot.exists()) {
        const displayName = user.displayName || 'User';
        const email = user.email;

        // Generate Username from Name
        const baseUsername = displayName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const uniqueUsername = await generateUniqueUsername(baseUsername);

        await userRef.set({
            name: displayName,
            username: uniqueUsername,
            email: email,
            createdAt: Date.now(),
            profilePic: user.photoURL || null
        });

        // Index the username
        await window.firebaseDatabase.ref('usernames/' + uniqueUsername).set(user.uid);
    }
}

async function generateUniqueUsername(base) {
    let candidate = base;
    let suffix = 1;

    while (true) {
        const taken = await window.isUsernameTaken(candidate);
        if (!taken) return candidate;
        candidate = `${base}_${Math.floor(Math.random() * 1000)}`;
    }
}

// ========================================
// UI HELPERS
// ========================================

function generateMathCaptcha(type) {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 + num2;

    if (type === 'login') {
        loginMath = { num1, num2, answer };
        const el = document.getElementById('mathQuestion');
        if (el) el.textContent = `${num1} + ${num2} = ?`;
    } else {
        signupMath = { num1, num2, answer };
        const el = document.getElementById('signupMathQuestion');
        if (el) el.textContent = `${num1} + ${num2} = ?`;
    }
}

// ========================================
// AUTH STATE UI
// ========================================
async function updateUI(user) {
    const authForms = document.getElementById('authForms');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userUsername = document.getElementById('userUsername');
    const verifiedBadge = document.getElementById('verifiedBadge');
    const unverifiedBadge = document.getElementById('unverifiedBadge');
    const verificationNotice = document.getElementById('verificationNotice');
    const ownerBadge = document.getElementById('ownerBadge');

    if (user) {
        if (authForms) authForms.style.display = 'none';
        if (userInfo) userInfo.classList.add('show');

        const username = await window.getUsername(user.uid);

        if (userName) userName.textContent = user.displayName || 'Welcome!';
        if (userUsername) userUsername.textContent = '@' + username;

        // Load and show profile picture
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            const profilePic = await getProfilePicture(user.uid);
            if (profilePic) {
                userAvatar.innerHTML = `<img src="${profilePic}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            }
        }

        const isUserOwner = await window.isOwner(user);
        if (ownerBadge) {
            ownerBadge.style.display = isUserOwner ? 'inline-flex' : 'none';
        }

        if (user.emailVerified) {
            if (verifiedBadge) verifiedBadge.style.display = 'inline-flex';
            if (unverifiedBadge) unverifiedBadge.style.display = 'none';
            if (verificationNotice) verificationNotice.classList.remove('show');
        } else {
            if (verifiedBadge) verifiedBadge.style.display = 'none';
            if (unverifiedBadge) unverifiedBadge.style.display = 'inline-flex';
            if (verificationNotice) verificationNotice.classList.add('show');
        }
    } else {
        if (authForms) authForms.style.display = 'block';
        if (userInfo) userInfo.classList.remove('show');
    }
}

// ========================================
// GET PROFILE PICTURE
// ========================================
async function getProfilePicture(userId) {
    try {
        const snapshot = await window.firebaseDatabase.ref('users/' + userId + '/profilePic').once('value');
        return snapshot.val() || null;
    } catch (error) {
        return null;
    }
}

// ========================================
// TAB SWITCHING
// ========================================
function initTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}Form`) {
                    form.classList.add('active');
                }
            });
        });
    });
}

// ========================================
// FORM HANDLERS
// ========================================
function initForms() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    const usernameInput = document.getElementById('signupUsername');
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        });
        usernameInput.addEventListener('blur', async (e) => {
            const username = e.target.value.trim();
            if (username.length >= 3) {
                const taken = await window.isUsernameTaken(username);
                const feedback = document.getElementById('usernameFeedback');
                if (feedback) {
                    feedback.textContent = taken ? '❌ Already taken' : '✓ Available';
                    feedback.style.color = taken ? 'var(--accent-error)' : 'var(--accent-success)';
                }
            }
        });
    }
}

// ========================================
// EMAIL LOGIN / SIGNUP
// ========================================
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const userAnswer = parseInt(document.getElementById('mathAnswer').value);
    const btn = e.target.querySelector('button[type="submit"]');
    const originalHTML = btn.innerHTML;

    if (userAnswer !== loginMath.answer) {
        showToast('Wrong captcha! Try again.', 'error');
        generateMathCaptcha('login');
        document.getElementById('mathAnswer').value = '';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    try {
        await window.firebaseAuth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    } catch (error) {
        showToast(getErrorMessage(error.code), 'error');
        generateMathCaptcha('login');
        document.getElementById('mathAnswer').value = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const username = document.getElementById('signupUsername').value.trim().toLowerCase();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const userAnswer = parseInt(document.getElementById('signupMathAnswer').value);
    const btn = e.target.querySelector('button[type="submit"]');
    const originalHTML = btn.innerHTML;

    // Validate (Simplified for brevity as Google Login is main focus)
    if (userAnswer !== signupMath.answer) return showToast('Wrong captcha', 'error');

    btn.disabled = true;
    btn.innerHTML = 'Creating Account...';

    try {
        const usernameTaken = await window.isUsernameTaken(username);
        if (usernameTaken) throw new Error('Username taken');

        const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        await user.updateProfile({ displayName: name });
        await window.firebaseDatabase.ref('users/' + user.uid).set({
            name: name,
            username: username,
            email: email,
            createdAt: Date.now()
        });
        await window.firebaseDatabase.ref('usernames/' + username).set(user.uid);
        await user.sendEmailVerification();

        showToast('Account created! Check email.', 'success');
        updateUI(user);
    } catch (error) {
        if (error.message === 'Username taken') showToast('Username already taken', 'error');
        else showToast(getErrorMessage(error.code), 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ========================================
// FORGOT PASSWORD
// ========================================

async function resetPassword() {
    // Revert to simple email reset because Phone is gone
    const email = prompt("Enter your email to reset password:");
    if (!email) return;

    try {
        await window.firebaseAuth.sendPasswordResetEmail(email);
        showToast('Password reset email sent!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Global Exports
window.handleGoogleLogin = handleGoogleLogin;
window.resetPassword = resetPassword;

// Helper
function getErrorMessage(code) {
    if (code === 'auth/wrong-password') return 'Incorrect Password';
    if (code === 'auth/user-not-found') return 'Account not found';
    if (code === 'auth/internal-error') return 'Firebase Config Error: Enable Phone Auth in Console & Add Domain.';
    if (code === 'auth/operation-not-allowed') return 'SMS Region Blocked: Enable this country code in Firebase Console.';
    if (code === 'auth/missing-phone-number') return 'Phone number missing';
    if (code === 'auth/quota-exceeded') return 'SMS quota exceeded';
    return code;
}

function initAuth() {
    const checkFirebase = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDatabase) {
            clearInterval(checkFirebase);

            window.firebaseAuth.onAuthStateChanged(async (user) => {
                await updateUI(user);
            });

            initTabs();
            initForms();
        }
    }, 100);

    setTimeout(() => clearInterval(checkFirebase), 5000);
}

// ========================================
// GENERATE MATH CAPTCHA
// ========================================
function generateMathCaptcha(type) {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const answer = num1 + num2;

    if (type === 'login') {
        loginMath = { num1, num2, answer };
        const el = document.getElementById('mathQuestion');
        if (el) el.textContent = `${num1} + ${num2} = ?`;
    } else {
        signupMath = { num1, num2, answer };
        const el = document.getElementById('signupMathQuestion');
        if (el) el.textContent = `${num1} + ${num2} = ?`;
    }
}

// ========================================
// PROFILE PICTURE PREVIEW
// ========================================
function previewProfile(input) {
    const errorEl = document.getElementById('profileError');
    const previewEl = document.getElementById('profilePreview');

    if (input.files && input.files[0]) {
        const file = input.files[0];

        // Check file size (max 1MB)
        if (file.size > 1024 * 1024) {
            if (errorEl) errorEl.textContent = 'File too large! Max 1MB';
            input.value = '';
            profileBase64 = null;
            return;
        }

        if (errorEl) errorEl.textContent = '';

        const reader = new FileReader();
        reader.onload = (e) => {
            profileBase64 = e.target.result;
            if (previewEl) {
                previewEl.innerHTML = `<img src="${profileBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;
            }
        };
        reader.readAsDataURL(file);
    }
}

// ========================================
// UPDATE UI BASED ON AUTH STATE
// ========================================
async function updateUI(user) {
    const authForms = document.getElementById('authForms');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userUsername = document.getElementById('userUsername');
    const verifiedBadge = document.getElementById('verifiedBadge');
    const unverifiedBadge = document.getElementById('unverifiedBadge');
    const verificationNotice = document.getElementById('verificationNotice');
    const ownerBadge = document.getElementById('ownerBadge');

    if (user) {
        if (authForms) authForms.style.display = 'none';
        if (userInfo) userInfo.classList.add('show');

        const username = await window.getUsername(user.uid);

        if (userName) userName.textContent = user.displayName || 'Welcome!';
        if (userUsername) userUsername.textContent = '@' + username;

        // Load and show profile picture
        const userAvatar = document.querySelector('.user-avatar');
        if (userAvatar) {
            const profilePic = await getProfilePicture(user.uid);
            if (profilePic) {
                userAvatar.innerHTML = `<img src="${profilePic}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            }
        }

        const isUserOwner = await window.isOwner(user);
        if (ownerBadge) {
            ownerBadge.style.display = isUserOwner ? 'inline-flex' : 'none';
        }

        if (user.emailVerified) {
            if (verifiedBadge) verifiedBadge.style.display = 'inline-flex';
            if (unverifiedBadge) unverifiedBadge.style.display = 'none';
            if (verificationNotice) verificationNotice.classList.remove('show');
        } else {
            if (verifiedBadge) verifiedBadge.style.display = 'none';
            if (unverifiedBadge) unverifiedBadge.style.display = 'inline-flex';
            if (verificationNotice) verificationNotice.classList.add('show');
        }
    } else {
        if (authForms) authForms.style.display = 'block';
        if (userInfo) userInfo.classList.remove('show');
    }
}

// ========================================
// GET PROFILE PICTURE
// ========================================
async function getProfilePicture(userId) {
    try {
        const snapshot = await window.firebaseDatabase.ref('users/' + userId + '/profilePic').once('value');
        return snapshot.val() || null;
    } catch (error) {
        return null;
    }
}

// ========================================
// TAB SWITCHING
// ========================================
function initTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            forms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}Form`) {
                    form.classList.add('active');
                }
            });
        });
    });
}

// ========================================
// FORM HANDLERS
// ========================================
function initForms() {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (signupForm) signupForm.addEventListener('submit', handleSignup);

    const usernameInput = document.getElementById('signupUsername');
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        });

        usernameInput.addEventListener('blur', async (e) => {
            const username = e.target.value.trim();
            if (username.length >= 3) {
                const taken = await window.isUsernameTaken(username);
                const feedback = document.getElementById('usernameFeedback');
                if (feedback) {
                    feedback.textContent = taken ? '❌ Already taken' : '✓ Available';
                    feedback.style.color = taken ? 'var(--accent-error)' : 'var(--accent-success)';
                }
            }
        });
    }
}

// ========================================
// LOGIN
// ========================================
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const userAnswer = parseInt(document.getElementById('mathAnswer').value);
    const btn = e.target.querySelector('button[type="submit"]');
    const originalHTML = btn.innerHTML;

    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    if (userAnswer !== loginMath.answer) {
        showToast('Wrong answer! Try again.', 'error');
        generateMathCaptcha('login');
        document.getElementById('mathAnswer').value = '';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

    try {
        const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!', 'success');

        const isUserOwner = await window.isOwner(userCredential.user);
        if (isUserOwner) showToast('Welcome back, Owner!', 'success');

        setTimeout(() => { window.location.href = 'index.html'; }, 1000);
    } catch (error) {
        showToast(getErrorMessage(error.code), 'error');
        generateMathCaptcha('login');
        document.getElementById('mathAnswer').value = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ========================================
// SIGNUP WITH PROFILE PICTURE
// ========================================
async function handleSignup(e) {
    e.preventDefault();

    const name = document.getElementById('signupName').value.trim();
    const username = document.getElementById('signupUsername').value.trim().toLowerCase();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;
    const userAnswer = parseInt(document.getElementById('signupMathAnswer').value);
    const btn = e.target.querySelector('button[type="submit"]');
    const originalHTML = btn.innerHTML;

    if (!name || !username || !email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }

    // Verify math captcha
    if (userAnswer !== signupMath.answer) {
        showToast('Wrong answer! Try again.', 'error');
        generateMathCaptcha('signup');
        document.getElementById('signupMathAnswer').value = '';
        return;
    }

    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
        showToast('Username: only letters, numbers, underscores', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';

    try {
        const usernameTaken = await window.isUsernameTaken(username);
        if (usernameTaken) {
            showToast('Username already taken', 'error');
            btn.disabled = false;
            btn.innerHTML = originalHTML;
            return;
        }

        const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;

        await user.updateProfile({ displayName: name });

        // Save user data with profile picture
        const userData = {
            username: username,
            name: name,
            createdAt: Date.now()
        };

        if (profileBase64) {
            userData.profilePic = profileBase64;
        }

        await window.firebaseDatabase.ref('users/' + user.uid).set(userData);
        await window.firebaseDatabase.ref('usernames/' + username).set(user.uid);
        await user.sendEmailVerification();

        showToast('Account created! Check email to verify.', 'success');
        profileBase64 = null;
        await updateUI(user);
    } catch (error) {
        showToast(getErrorMessage(error.code), 'error');
        generateMathCaptcha('signup');
        document.getElementById('signupMathAnswer').value = '';
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// ========================================
// OTHER FUNCTIONS
// ========================================
async function logout() {
    try {
        await window.firebaseAuth.signOut();
        showToast('Logged out', 'success');
        setTimeout(() => { window.location.href = 'index.html'; }, 500);
    } catch (error) {
        showToast('Error logging out', 'error');
    }
}

async function resendVerification() {
    const user = window.firebaseAuth?.currentUser;
    if (user && !user.emailVerified) {
        try {
            await user.sendEmailVerification();
            showToast('Verification email sent!', 'success');
        } catch (error) {
            showToast('Please wait before requesting again', 'error');
        }
    }
}

async function resetPassword() {
    const email = document.getElementById('loginEmail')?.value.trim();
    if (!email) {
        showToast('Enter your email first', 'error');
        return;
    }
    try {
        await window.firebaseAuth.sendPasswordResetEmail(email);
        showToast('Password reset email sent!', 'success');
    } catch (error) {
        showToast(getErrorMessage(error.code), 'error');
    }
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');
    input.type = input.type === 'password' ? 'text' : 'password';
    icon.classList.toggle('fa-eye');
    icon.classList.toggle('fa-eye-slash');
}

function getErrorMessage(errorCode) {
    const messages = {
        'auth/email-already-in-use': 'Email already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password too weak',
        'auth/user-not-found': 'No account found',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Invalid email or password',
        'auth/too-many-requests': 'Too many attempts, try later'
    };
    return messages[errorCode] || 'An error occurred';
}

window.logout = logout;
window.resendVerification = resendVerification;
window.resetPassword = resetPassword;
window.togglePassword = togglePassword;
window.previewProfile = previewProfile;
window.getProfilePicture = getProfilePicture;

// ========================================
// PHONE LOGIN & QUOTA SYSTEM
// ========================================

async function checkSMSQuota() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    try {
        const snapshot = await window.firebaseDatabase.ref(`quotas/${today}/sms_count`).once('value');
        const count = snapshot.val() || 0;
        console.log(`Today's SMS Check: ${count}/10`);

        const phoneTab = document.getElementById('phoneTab');
        if (count < 10) {
            if (phoneTab) phoneTab.style.display = 'block';
        } else {
            if (phoneTab) phoneTab.style.display = 'none';
            console.log("SMS Quota Exceeded for today.");
        }
    } catch (error) {
        console.error("Error checking quota:", error);
    }
}

async function incrementSMSQuota() {
    const today = new Date().toISOString().split('T')[0];
    const ref = window.firebaseDatabase.ref(`quotas/${today}/sms_count`);

    // Transaction to safely increment
    await ref.transaction((currentValue) => {
        return (currentValue || 0) + 1;
    });
}

// Initialize Recaptcha Verifier
function initRecaptcha() {
    if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                // reCAPTCHA solved, allow signInWithPhoneNumber.
            }
        });
    }
}

// Handle Phone Login Submit
async function handlePhoneLogin(e) {
    e.preventDefault();

    // Double check quota before sending
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await window.firebaseDatabase.ref(`quotas/${today}/sms_count`).once('value');
    if ((snapshot.val() || 0) >= 10) {
        showToast('Daily SMS limit reached. Use email login.', 'error');
        return;
    }

    const phoneNumber = document.getElementById('phoneNumber').value.trim();
    if (!phoneNumber) {
        showToast('Please enter a phone number', 'error');
        return;
    }

    // Basic validation
    if (!/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
        showToast('Invalid format. Use +[Country][Number]', 'error');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    initRecaptcha();
    const appVerifier = window.recaptchaVerifier;

    try {
        await incrementSMSQuota(); // Count this attempt

        const confirmationResult = await window.firebaseAuth.signInWithPhoneNumber(phoneNumber, appVerifier);
        window.confirmationResult = confirmationResult;

        showToast('SMS sent successfully!', 'success');
        document.getElementById('phoneInputSection').style.display = 'none';
        document.getElementById('otpSection').style.display = 'block';

    } catch (error) {
        showToast(getErrorMessage(error.code), 'error');
        console.error(error);
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.render().then(function (widgetId) {
                grecaptcha.reset(widgetId);
            })
        }
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

async function verifyOTP() {
    const otp = document.getElementById('otpCode').value.trim();
    if (!otp || otp.length !== 6) {
        showToast('Enter a valid 6-digit code', 'error');
        return;
    }

    const btn = document.querySelector('#otpSection button.btn-primary');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

    try {
        const result = await window.confirmationResult.confirm(otp);
        const user = result.user;
        showToast('Login successful!', 'success');

        // Save minimal user data if new
        const snapshot = await window.firebaseDatabase.ref('users/' + user.uid).once('value');
        if (!snapshot.exists()) {
            await window.firebaseDatabase.ref('users/' + user.uid).set({
                phoneNumber: user.phoneNumber,
                createdAt: Date.now(),
                username: 'user_' + user.uid.slice(0, 5) // Temporary username
            });
        }

        setTimeout(() => { window.location.href = 'index.html'; }, 1000);

    } catch (error) {
        showToast('Invalid Code', 'error');
        console.error(error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

function resetPhoneForm() {
    document.getElementById('phoneInputSection').style.display = 'block';
    document.getElementById('otpSection').style.display = 'none';
    document.getElementById('otpCode').value = '';
}

window.verifyOTP = verifyOTP;
window.resetPhoneForm = resetPhoneForm;

// Extend initForms to include phone listener
const originalInitForms = initForms;
initForms = function () {
    originalInitForms();
    const phoneForm = document.getElementById('phoneForm');
    if (phoneForm) phoneForm.addEventListener('submit', handlePhoneLogin);
    checkSMSQuota(); // Check on load
};

// Extend auth error messages
const originalGetErrorMessage = getErrorMessage;
getErrorMessage = function (errorCode) {
    const phoneMessages = {
        'auth/invalid-phone-number': 'Invalid phone number format',
        'auth/quota-exceeded': 'SMS quota exceeded',
        'auth/captcha-check-failed': 'Recaptcha failed, try again'
    };
    return phoneMessages[errorCode] || originalGetErrorMessage(errorCode);
};
