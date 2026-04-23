const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/profileController');

router.post('/create',        ctrl.createMember);
router.post('/login',         ctrl.loginMember);
router.post('/get',           ctrl.getMember);
router.post('/update',        ctrl.updateMember);
router.post('/delete',        ctrl.deleteMember);
router.post('/search',        ctrl.searchMembers);
router.post('/skills/add',    ctrl.addSkill);
router.post('/skills/remove', ctrl.removeSkill);

module.exports = router;
