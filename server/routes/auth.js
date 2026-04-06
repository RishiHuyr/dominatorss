const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const CALLBACK_URL = process.env.GITHUB_CALLBACK_URL;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5000';

// GET /auth/github → Redirect to GitHub OAuth
router.get('/github', (req, res) => {
    console.log(`[OAuth] Preparing fresh login flow...`);

    // Force account choice (instruct provider)
    const state = Math.random().toString(36).substring(7);
    
    // Clear old session data if it exists to prevent auto-reuse
    if (req.session) {
        console.log(`[OAuth] Resetting current session for account switching...`);
        // We preserve just the state in the new session after redirect
    }

    const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: CALLBACK_URL,
        scope: 'repo read:user user:email',
        state: state,
        prompt: 'select_account' // instruct GitHub to show account chooser
    });

    req.session.oauth_state = state;
    console.log(`[OAuth] Redirecting to GitHub with prompt: select_account`);
    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

// GET /auth/github/callback → Handle GitHub redirect
router.get('/github/callback', async (req, res) => {
    const { code, state, error: ghError, error_description } = req.query;
    console.log(`[OAuth] Received callback from GitHub.`);

    if (ghError) {
        console.error(`[OAuth] GitHub returned an error: ${ghError} - ${error_description}`);
        return res.redirect(`${FRONTEND_URL}/settings.html?oauth=error&msg=${encodeURIComponent(ghError)}`);
    }

    if (!code || !state || state !== req.session.oauth_state) {
        console.error(`[OAuth] State mismatch or missing code. Potential CSRF.`);
        return res.redirect(`${FRONTEND_URL}/settings.html?oauth=error&msg=CSRF_FAILED`);
    }

    try {
        console.log(`[OAuth] Exchanging authorization code for access token...`);
        const tokenRes = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: CALLBACK_URL
            },
            { headers: { Accept: 'application/json' } }
        );

        const { access_token, error, error_description: tokenErrDesc } = tokenRes.data;
        
        if (error) {
            console.error(`[OAuth] Token exchange failed: ${error} - ${tokenErrDesc}`);
            // Check for redirect_uri_mismatch specifically
            if (error === 'redirect_uri_mismatch') {
                console.error(`[OAuth] CRITICAL: Ensure GitHub App Callback URL matches: ${CALLBACK_URL}`);
            }
            return res.redirect(`${FRONTEND_URL}/settings.html?oauth=error&msg=${error}`);
        }

        console.log(`[OAuth] Token acquired successfully. Fetching user profile...`);

        // Fetch user profile
        const userRes = await axios.get('https://api.github.com/user', {
            headers: { 
                Authorization: `Bearer ${access_token}`,
                'User-Agent': 'OpenIssue-Triage-App'
            }
        });
        const { id, login, avatar_url } = userRes.data;

        console.log(`[OAuth] User profile fetched: ${login} (ID: ${id})`);

        // Upsert User persistence
        let user = await User.findOne({ githubId: id.toString() });
        if (!user) {
            user = new User({ githubId: id.toString(), username: login });
        }
        user.accessToken = access_token;
        user.avatar = avatar_url;
        user.username = login;
        user.connectedAt = new Date();
        await user.save();

        // Establish session state
        const userData = {
            id: id.toString(),
            login: login,
            avatar_url: avatar_url
        };
        req.session.user = userData;
        req.session.githubId = id.toString();
        req.session.username = login;
        delete req.session.oauth_state; // Clean up state

        console.log(`[OAuth] Session updated for user: ${login}`);
        res.redirect(`${FRONTEND_URL}/settings.html?oauth=success&login=${login}`);

    } catch (e) {
        console.error(`[OAuth] Internal error during callback:`, e.response?.data || e.message);
        res.redirect(`${FRONTEND_URL}/settings.html?oauth=error&msg=INTERNAL_SERVER_ERROR`);
    }
});

// GET /auth/user → Return current session user
router.get('/user', (req, res) => {
    if (req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.status(401).json({ success: false, message: 'Not authenticated' });
    }
});

// GET /auth/status → check if connected
router.get('/status', async (req, res) => {
    const githubId = req.session.githubId;
    if (!githubId) return res.json({ connected: false });

    try {
        const user = await User.findOne({ githubId });
        if (user && user.accessToken) {
            res.json({
                connected: true,
                username: user.username,
                avatar: user.avatar,
                connectedAt: user.connectedAt
            });
        } else {
            res.json({ connected: false });
        }
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /auth/logout → Disconnect
router.post('/logout', async (req, res) => {
    const githubId = req.session.githubId;
    console.log(`[OAuth] Logging out user: ${req.session.username || 'unknown'}`);
    
    if (githubId) {
        await User.findOneAndUpdate({ githubId }, { accessToken: null });
    }
    
    req.session.user = null;
    req.session.destroy((err) => {
        if (err) console.error(`[OAuth] Session destruction error:`, err);
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

module.exports = router;
