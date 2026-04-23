const express = require('express');
const router = express.Router();
const EventLog = require('../models/eventLog');

function parseWindowDays(value, fallback = 30) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function sinceDate(windowDays) {
  return new Date(Date.now() - windowDays * 86400000);
}

async function computeAiMetrics(windowDays, recruiterId = null) {
  const since = sinceDate(windowDays);
  const match = {
    event_type: 'ai.results',
    timestamp: { $gte: since },
  };
  if (recruiterId) match.actor_id = recruiterId;

  const [approvalCounts, quality] = await Promise.all([
    EventLog.aggregate([
      { $match: match },
      { $match: { 'payload.approval_action': { $in: ['approve', 'edit', 'reject'] } } },
      { $group: { _id: '$payload.approval_action', count: { $sum: 1 } } },
    ]),
    EventLog.aggregate([
      { $match: match },
      { $unwind: { path: '$payload.shortlist', preserveNullAndEmptyArrays: false } },
      { $group: {
          _id: null,
          avg_match_score: { $avg: '$payload.shortlist.match_score' },
          evaluated_candidates: { $sum: 1 },
          avg_skills_overlap: { $avg: { $size: { $ifNull: ['$payload.shortlist.skills_overlap', []] } } },
        }
      },
    ]),
  ]);

  const counts = Object.fromEntries(approvalCounts.map((row) => [row._id, row.count]));
  const totalApprovals = (counts.approve || 0) + (counts.edit || 0) + (counts.reject || 0);
  const qualityRow = quality[0] || {};

  return {
    approval_counts: {
      approved_as_is: counts.approve || 0,
      edited_then_approved: counts.edit || 0,
      rejected: counts.reject || 0,
      total_reviewed: totalApprovals,
    },
    approval_rate: totalApprovals ? Number((((counts.approve || 0) + (counts.edit || 0)) / totalApprovals).toFixed(3)) : 0,
    average_match_score: qualityRow.avg_match_score ? Number(qualityRow.avg_match_score.toFixed(3)) : 0,
    average_skills_overlap: qualityRow.avg_skills_overlap ? Number(qualityRow.avg_skills_overlap.toFixed(2)) : 0,
    evaluated_candidates: qualityRow.evaluated_candidates || 0,
  };
}

// POST /events/ingest — manual event ingestion from UI
router.post('/ingest', async (req, res) => {
  try {
    const event = req.body;
    if (!event.event_type) return res.status(400).json({ error: 'event_type required' });
    await EventLog.create({ ...event, timestamp: event.timestamp ? new Date(event.timestamp) : new Date() });
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 11000) return res.status(200).json({ success: true, duplicate: true });
    console.error('events ingest error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /analytics/jobs/top — top jobs by applications/views/saves
router.post('/jobs/top', async (req, res) => {
  const metric = req.body.metric || 'applications';
  const window_days = parseWindowDays(req.body.window_days, 30);
  const limit = Math.max(parseInt(req.body.limit, 10) || 10, 1);
  const since = sinceDate(window_days);

  let match;
  let projectJobId;
  if (metric === 'applications') {
    match = { event_type: 'application.submitted', timestamp: { $gte: since } };
    projectJobId = '$payload.job_id';
  } else if (metric === 'saves') {
    match = { event_type: 'job.saved', timestamp: { $gte: since } };
    projectJobId = '$entity.entity_id';
  } else {
    match = { event_type: 'job.viewed', timestamp: { $gte: since } };
    projectJobId = '$entity.entity_id';
  }

  try {
    const results = await EventLog.aggregate([
      { $match: match },
      { $project: { job_id: projectJobId } },
      { $match: { job_id: { $ne: null } } },
      { $group: { _id: '$job_id', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { job_id: '$_id', count: 1, _id: 0 } },
    ]);
    res.json({ metric, window_days, results });
  } catch (err) {
    console.error('analytics jobs/top error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /analytics/funnel — view→save→apply funnel for a job
router.post('/funnel', async (req, res) => {
  const { job_id } = req.body;
  const window_days = parseWindowDays(req.body.window_days, 30);
  if (!job_id) return res.status(400).json({ error: 'job_id required' });
  const since = sinceDate(window_days);

  try {
    const [views, saves, applyStarts, apps] = await Promise.all([
      EventLog.countDocuments({ event_type: 'job.viewed', 'entity.entity_id': job_id, timestamp: { $gte: since } }),
      EventLog.countDocuments({ event_type: 'job.saved', 'entity.entity_id': job_id, timestamp: { $gte: since } }),
      EventLog.countDocuments({ event_type: 'application.started', 'payload.job_id': job_id, timestamp: { $gte: since } }),
      EventLog.countDocuments({ event_type: 'application.submitted', 'payload.job_id': job_id, timestamp: { $gte: since } }),
    ]);
    res.json({ job_id, funnel: { views, saves, apply_start: applyStarts, submissions: apps }, window_days });
  } catch (err) {
    console.error('analytics funnel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /analytics/geo — city/state distribution for a job
router.post('/geo', async (req, res) => {
  const { job_id } = req.body;
  const window_days = parseWindowDays(req.body.window_days, 30);
  if (!job_id) return res.status(400).json({ error: 'job_id required' });
  const since = sinceDate(window_days);

  try {
    const results = await EventLog.aggregate([
      { $match: { event_type: 'application.submitted', 'payload.job_id': job_id, timestamp: { $gte: since } } },
      { $project: {
          city: { $ifNull: ['$payload.city', 'Unknown'] },
          state: { $ifNull: ['$payload.state', 'Unknown'] },
        }
      },
      { $group: { _id: { city: '$city', state: '$state' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, city: '$_id.city', state: '$_id.state', count: 1 } },
    ]);
    res.json({ job_id, geo: results, window_days });
  } catch (err) {
    console.error('analytics geo error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /analytics/member/dashboard — profile views + application breakdown
router.post('/member/dashboard', async (req, res) => {
  const { member_id } = req.body;
  const window_days = parseWindowDays(req.body.window_days, 30);
  if (!member_id) return res.status(400).json({ error: 'member_id required' });
  const since = sinceDate(window_days);

  try {
    const [profileViews, appBreakdown] = await Promise.all([
      EventLog.aggregate([
        { $match: { event_type: 'profile.viewed', 'entity.entity_id': member_id, timestamp: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, views: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: '$_id', views: 1 } },
      ]),
      EventLog.aggregate([
        { $match: {
            event_type: { $in: ['application.submitted', 'application.status.changed'] },
            'payload.member_id': member_id,
            timestamp: { $gte: since },
          }
        },
        { $sort: { timestamp: -1 } },
        { $project: {
            application_id: { $ifNull: ['$payload.application_id', '$entity.entity_id'] },
            current_status: {
              $cond: [
                { $eq: ['$event_type', 'application.status.changed'] },
                '$payload.new_status',
                { $ifNull: ['$payload.status', 'submitted'] },
              ],
            },
          }
        },
        { $group: { _id: '$application_id', current_status: { $first: '$current_status' } } },
        { $group: { _id: '$current_status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } },
      ]),
    ]);

    res.json({ member_id, profile_views: profileViews, application_status_breakdown: appBreakdown, window_days });
  } catch (err) {
    console.error('member dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /analytics/recruiter/dashboard — required recruiter graphs + AI metrics
router.post('/recruiter/dashboard', async (req, res) => {
  const { recruiter_id, selected_job_id = null } = req.body;
  const window_days = parseWindowDays(req.body.window_days, 30);
  if (!recruiter_id) return res.status(400).json({ error: 'recruiter_id required' });
  const since = sinceDate(window_days);

  try {
    const [
      topJobs,
      topJobsPerMonth,
      lowTraction,
      savedPerDay,
      savedPerWeek,
      clicksPerJob,
      cityWiseSelectedJob,
      aiMetrics,
    ] = await Promise.all([
      EventLog.aggregate([
        { $match: { event_type: 'application.submitted', 'payload.recruiter_id': recruiter_id, timestamp: { $gte: since } } },
        { $group: { _id: '$payload.job_id', applications: { $sum: 1 } } },
        { $sort: { applications: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, job_id: '$_id', applications: 1 } },
      ]),
      EventLog.aggregate([
        { $match: { event_type: 'application.submitted', 'payload.recruiter_id': recruiter_id, timestamp: { $gte: since } } },
        { $group: {
            _id: {
              job_id: '$payload.job_id',
              month: { $dateToString: { format: '%Y-%m', date: '$timestamp' } },
            },
            applications: { $sum: 1 },
          }
        },
        { $sort: { '_id.month': 1, applications: -1 } },
        { $project: { _id: 0, job_id: '$_id.job_id', month: '$_id.month', applications: 1 } },
      ]),
      EventLog.aggregate([
        { $match: { event_type: 'application.submitted', 'payload.recruiter_id': recruiter_id, timestamp: { $gte: since } } },
        { $group: { _id: '$payload.job_id', applications: { $sum: 1 } } },
        { $sort: { applications: 1 } },
        { $limit: 5 },
        { $project: { _id: 0, job_id: '$_id', applications: 1 } },
      ]),
      EventLog.aggregate([
        { $match: { event_type: 'job.saved', 'payload.recruiter_id': recruiter_id, timestamp: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: '$_id', count: 1 } },
      ]),
      EventLog.aggregate([
        { $match: { event_type: 'job.saved', 'payload.recruiter_id': recruiter_id, timestamp: { $gte: since } } },
        { $group: {
            _id: {
              isoWeekYear: { $isoWeekYear: '$timestamp' },
              isoWeek: { $isoWeek: '$timestamp' },
            },
            count: { $sum: 1 },
          }
        },
        { $sort: { '_id.isoWeekYear': 1, '_id.isoWeek': 1 } },
        { $project: {
            _id: 0,
            week: {
              $concat: [
                { $toString: '$_id.isoWeekYear' },
                '-W',
                { $toString: '$_id.isoWeek' },
              ],
            },
            count: 1,
          }
        },
      ]),
      EventLog.aggregate([
        { $match: { event_type: 'job.viewed', 'payload.recruiter_id': recruiter_id, timestamp: { $gte: since } } },
        { $group: { _id: '$entity.entity_id', clicks: { $sum: 1 } } },
        { $sort: { clicks: -1 } },
        { $project: { _id: 0, job_id: '$_id', clicks: 1 } },
      ]),
      selected_job_id ? EventLog.aggregate([
        { $match: {
            event_type: 'application.submitted',
            'payload.recruiter_id': recruiter_id,
            'payload.job_id': selected_job_id,
            timestamp: { $gte: since },
          }
        },
        { $group: {
            _id: {
              city: { $ifNull: ['$payload.city', 'Unknown'] },
              month: { $dateToString: { format: '%Y-%m', date: '$timestamp' } },
            },
            applications: { $sum: 1 },
          }
        },
        { $sort: { '_id.month': 1, applications: -1 } },
        { $project: { _id: 0, city: '$_id.city', month: '$_id.month', applications: 1 } },
      ]) : Promise.resolve([]),
      computeAiMetrics(window_days, recruiter_id),
    ]);

    res.json({
      recruiter_id,
      window_days,
      selected_job_id,
      top_jobs_by_applications: topJobs,
      top_jobs_by_applications_per_month: topJobsPerMonth,
      low_traction_jobs: lowTraction,
      clicks_per_job: clicksPerJob,
      saved_jobs_per_day: savedPerDay,
      saved_jobs_per_week: savedPerWeek,
      city_wise_applications_per_month: cityWiseSelectedJob,
      ai_metrics: aiMetrics,
    });
  } catch (err) {
    console.error('recruiter dashboard error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/ai/metrics', async (req, res) => {
  const window_days = parseWindowDays(req.body.window_days, 30);
  const recruiter_id = req.body.recruiter_id || null;
  try {
    const results = await computeAiMetrics(window_days, recruiter_id);
    res.json({ recruiter_id, window_days, ...results });
  } catch (err) {
    console.error('ai metrics error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
