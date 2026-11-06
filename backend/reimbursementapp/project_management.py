import requests
from django.conf import settings


class ProjectManagementAPIError(Exception):
    pass


def fetch_projects():
    base_url = settings.PROJECT_MANAGEMENT_API_URL
    token = settings.PROJECT_MANAGEMENT_API_TOKEN

    if not base_url or not token:
        raise ProjectManagementAPIError(
            "Project Management API is not configured."
        )

    try:
        response = requests.get(
            f"{base_url}/api/v1/hrms/projects/",
            headers={"Authorization": f"Bearer {token}"},
            timeout=(3, 10),
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ProjectManagementAPIError(
            "Could not fetch projects from Project Management."
        ) from exc

    try:
        payload = response.json()
    except ValueError as exc:
        raise ProjectManagementAPIError(
            "Project Management returned invalid JSON."
        ) from exc

    projects = payload.get("results")
    if not isinstance(projects, list):
        raise ProjectManagementAPIError(
            "Project Management response missing results list."
        )

    return projects


def find_project(project_id):
    for project in fetch_projects():
        if str(project.get("id")) == str(project_id):
            return project
    return None