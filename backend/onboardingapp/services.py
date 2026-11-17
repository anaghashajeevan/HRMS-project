def structure_ancestor_ids(structure):
    ids = set()
    current = structure
    while current is not None and current.pk not in ids:
        ids.add(current.pk)
        current = current.parent
    return ids


def template_matches_employee(template, employee):
    department_ids = set()
    if employee.department_id:
        department_ids.update(structure_ancestor_ids(employee.department))
    if employee.position_id and employee.position.department_id:
        department_ids.update(structure_ancestor_ids(employee.position.department))

    location_ids = set()
    if employee.location_id:
        location_ids.update(structure_ancestor_ids(employee.location))
    if employee.structure_location_id:
        location_ids.update(structure_ancestor_ids(employee.structure_location))

    if template.department_id and template.department_id not in department_ids:
        return False
    if template.position_id and template.position_id != employee.position_id:
        return False
    if template.location_id and template.location_id not in location_ids:
        return False
    return True
