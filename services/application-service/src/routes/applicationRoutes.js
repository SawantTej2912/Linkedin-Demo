const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/applicationController');

router.post('/submit',        ctrl.submitApplication);
router.post('/get',           ctrl.getApplication);
router.post('/byJob',         ctrl.applicationsByJob);
router.post('/byMember',      ctrl.applicationsByMember);
router.post('/updateStatus',  ctrl.updateStatus);
router.post('/addNote',       ctrl.addNote);

module.exports = router;
