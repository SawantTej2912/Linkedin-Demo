const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/jobController');

router.post('/create',      ctrl.createJob);
router.post('/get',         ctrl.getJob);
router.post('/update',      ctrl.updateJob);
router.post('/search',      ctrl.searchJobs);
router.post('/close',       ctrl.closeJob);
router.post('/byRecruiter', ctrl.jobsByRecruiter);
router.post('/save',        ctrl.saveJob);
router.post('/unsave',      ctrl.unsaveJob);
router.post('/saved',       ctrl.savedByMember);

module.exports = router;
