export default function CareerResourcesPage() {
  const items = [
    {
      title: 'Resume Improvement Checklist',
      body: 'Lead each bullet with impact, quantify outcomes, and tailor keywords to the role description.',
    },
    {
      title: 'Interview Prep Plan',
      body: 'Block 45 minutes daily for problem solving, system design practice, and behavioral storytelling.',
    },
    {
      title: 'Networking Playbook',
      body: 'Engage with domain posts, share concise learnings, and follow up with thoughtful messages.',
    },
  ];

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 24, color: '#0f172a' }}>Career Resources</h2>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
          Practical resources to improve profile quality, interview outcomes, and networking consistency.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(item => (
          <section key={item.title} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#0f172a' }}>{item.title}</h3>
            <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.6 }}>{item.body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
