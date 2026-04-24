const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/postController');

router.get('/', ctrl.getFeed);
router.get('/saved', ctrl.getSavedPosts);
router.post('/', ctrl.createPost);
router.post('/:postId/like', ctrl.likePost);
router.delete('/:postId/like', ctrl.unlikePost);
router.post('/:postId/save', ctrl.savePost);
router.delete('/:postId/save', ctrl.unsavePost);
router.post('/:postId/comments', ctrl.addComment);
router.delete('/:postId/comments/:commentId', ctrl.deleteComment);

module.exports = router;
