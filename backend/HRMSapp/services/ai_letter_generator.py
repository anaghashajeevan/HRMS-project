"""
Groq AI service for generating letter templates.
"""
import logging
from groq import Groq
from django.conf import settings

logger = logging.getLogger(__name__)


AVAILABLE_VARIABLES = """
Available placeholders (use with double curly braces):
- {{employee_name}} - Full name of the employee
- {{employee_id}} - Employee ID (e.g., EMP-2026-001)
- {{current_position}} - Current job title
- {{current_department}} - Current department
- {{new_position}} - New job title
- {{new_department}} - New department name
- {{new_manager}} - New reporting manager's name
- {{effective_date}} - Date changes take effect
- {{current_date}} - Today's date
- {{company_name}} - Company name
- {{reason}} - Reason for the change
"""

SYSTEM_PROMPT = f"""You are a professional HR letter template generator.

Generate ONLY the letter body content. The system will automatically add:
- Company logo
- Company name and details
- Date/reference number
- Letter type heading
- HR signature
- Company seal
- Footer

STRICT RULES:
1. Return ONLY simple HTML.
2. Do NOT use tables.
3. Do NOT use CSS styles.
4. Do NOT include <html>, <head>, <body>, <div>, or <table>.
5. Use only these tags: <h2>, <h3>, <p>, <strong>, <em>, <ul>, <li>, <br>.
6. Do NOT use markdown like **bold**.
7. Include the salutation inside the body:
   <p>Dear {{{{employee_name}}}},</p>
8. Use ONLY these placeholder variables:
{AVAILABLE_VARIABLES}
9. Keep it professional, complete, and not too short.
10. Mention all relevant details where appropriate:
   employee name, employee ID, current/new position, department, manager, effective date.

Example format:
<h2>Promotion Announcement</h2>
<p>Dear {{{{employee_name}}}},</p>
<p>We are pleased to inform you...</p>
<p>Effective <strong>{{{{effective_date}}}}</strong>, your new role will be <strong>{{{{new_position}}}}</strong>.</p>
<p>Your employee ID is <strong>{{{{employee_id}}}}</strong>.</p>
<p>We appreciate your contributions and wish you continued success.</p>
<p>Sincerely,</p>
"""


def generate_letter_template(user_prompt: str, template_type: str) -> str:
    """
    Generate HTML letter template using Groq AI.
    
    Args:
        user_prompt: HR user's description of what they want
        template_type: PROMOTION / TRANSFER / etc.
    
    Returns:
        HTML string ready to save as template
    """
    if not settings.GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY not configured in settings")

    client = Groq(api_key=settings.GROQ_API_KEY)

    user_message = f"""
Template Type: {template_type.replace('_', ' ').title()}

User's Requirements:
{user_prompt}

Generate ONLY the letter body as simple HTML.
Do not include company header, logo, date, signature, seal, footer, or table layouts.
"""

    try:
        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=2500,
        )

        html = completion.choices[0].message.content.strip()

        # Clean markdown wrapping if AI added it
        if html.startswith('```'):
            parts = html.split('```')
            if len(parts) >= 2:
                html = parts[1]
                if html.startswith('html'):
                    html = html[4:].strip()

        logger.info(f"✅ Groq AI generated template for {template_type}")
        return html.strip()

    except Exception as e:
        logger.error(f"❌ Groq AI generation failed: {e}")
        raise