import json
import re
from shared.llm_client import chat_complete, has_llm
from .schemas import ParsedResume

SYSTEM_PROMPT = """You are a resume parser. Extract structured information from the resume text.
Return ONLY valid JSON matching this schema:
{
  "skills": ["skill1", "skill2"],
  "years_experience": 3.5,
  "education": [{"degree": "BS", "field": "Computer Science", "school": "MIT", "year": 2020}],
  "job_titles": ["Software Engineer", "Intern"],
  "summary": "Brief professional summary"
}"""

KNOWN_SKILLS = [
    'python', 'javascript', 'typescript', 'java', 'go', 'rust', 'c++', 'react', 'node.js', 'node',
    'vue', 'angular', 'next.js', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'kafka',
    'rabbitmq', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'machine learning', 'tensorflow',
    'pytorch', 'spark', 'scala', 'graphql', 'rest', 'grpc', 'microservices', 'linux', 'git', 'terraform',
    'jenkins', 'airflow', 'sql', 'tableau', 'figma', 'ci/cd', 'system design'
]

KNOWN_TITLES = [
    'software engineer', 'senior software engineer', 'backend engineer', 'frontend engineer',
    'full stack engineer', 'data engineer', 'ml engineer', 'machine learning engineer',
    'data scientist', 'data analyst', 'devops engineer', 'site reliability engineer',
    'product manager', 'solutions architect', 'security engineer', 'intern'
]

DEGREE_PATTERNS = [
    ('BS', r'\b(b\.s\.|bs|bachelor(?:\'s)? of science)\b'),
    ('BA', r'\b(b\.a\.|ba|bachelor(?:\'s)? of arts)\b'),
    ('MS', r'\b(m\.s\.|ms|master(?:\'s)? of science)\b'),
    ('MBA', r'\b(mba|master of business administration)\b'),
    ('PhD', r'\b(ph\.?d\.?|doctorate)\b'),
]


def heuristic_parse_resume(resume_text: str) -> ParsedResume:
    text = resume_text or ''
    lower = text.lower()

    skills = []
    for skill in KNOWN_SKILLS:
        if skill in lower:
            normalized = 'Node.js' if skill in {'node', 'node.js'} else skill.title().replace('Aws', 'AWS').replace('Gcp', 'GCP').replace('Ci/Cd', 'CI/CD')
            if normalized not in skills:
                skills.append(normalized)

    years_matches = [int(x) for x in re.findall(r'(\d{1,2})\+?\s+years?', lower)]
    years_experience = float(max(years_matches)) if years_matches else 0.0

    job_titles = []
    for title in KNOWN_TITLES:
        if title in lower:
            job_titles.append(title.title().replace('Ml', 'ML'))
    if not job_titles:
        for line in text.splitlines()[:10]:
            clean = line.strip()
            if 3 <= len(clean.split()) <= 6:
                job_titles.append(clean)
                break

    education = []
    degree = None
    for label, pattern in DEGREE_PATTERNS:
        if re.search(pattern, lower):
            degree = label
            break
    if degree:
        school_match = re.search(r'(university|college|institute|school)[^\n,]{0,40}', text, re.IGNORECASE)
        year_match = re.search(r'\b(19|20)\d{2}\b', text)
        education.append({
            'degree': degree,
            'field': 'Computer Science' if 'computer science' in lower else None,
            'school': school_match.group(0).strip() if school_match else None,
            'year': int(year_match.group(0)) if year_match else None,
        })

    summary = ' '.join([line.strip() for line in text.splitlines() if line.strip()][:3])[:280] or None
    return ParsedResume(
        skills=skills[:20],
        years_experience=years_experience,
        education=education,
        job_titles=job_titles[:8],
        summary=summary,
    )


async def parse_resume(resume_text: str) -> ParsedResume:
    if not has_llm():
        return heuristic_parse_resume(resume_text)

    content = await chat_complete([
        {'role': 'system', 'content': SYSTEM_PROMPT},
        {'role': 'user', 'content': f'Parse this resume:\n\n{(resume_text or "")[:4000]}'},
    ])
    try:
        data = json.loads(content)
        return ParsedResume(**data)
    except Exception:
        match = re.search(r'\{.*\}', content, re.DOTALL)
        if match:
            return ParsedResume(**json.loads(match.group()))
        return heuristic_parse_resume(resume_text)
