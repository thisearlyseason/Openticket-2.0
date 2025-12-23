const admin = require('firebase-admin');

admin.initializeApp({
    projectId: 'openticket-4f5bc',
});

module.exports = admin;
