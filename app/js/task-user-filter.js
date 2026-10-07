// Shared by the Kanban/list predicate and both user filter controls.
const normalize = value => String(value ?? '').trim().toLowerCase();
const identifiers = person => (person && typeof person === 'object'
    ? [person.name, person.email] : [person]).map(normalize).filter(Boolean);
const taskPeople = task => [...(Array.isArray(task.responsible) ? task.responsible : []), task.homologador];

export function taskMatchesUser(task, selected, users = []) {
    const target = normalize(selected);
    if (!target || target === 'all') return true;
    const aliases = new Set([target]);
    // Resolve a selected display name/email through the already loaded directory.
    for (const user of users || []) {
        const values = identifiers(user);
        if (values.includes(target)) values.forEach(value => aliases.add(value));
    }
    return taskPeople(task).some(person => identifiers(person).some(value => aliases.has(value)));
}

export function taskUserFilterOptions(tasks, selected) {
    const names = (tasks || []).flatMap(taskPeople).map(person =>
        person && typeof person === 'object' ? (person.name || person.email) : person
    ).filter(value => normalize(value));
    if (selected && selected !== 'all') names.push(selected);
    // Preserve the selected spelling so either control can route to its exact chip.
    const choices = new Map();
    for (const name of names) choices.set(normalize(name), String(name).trim());
    if (selected && selected !== 'all') choices.set(normalize(selected), selected);
    return [...choices.values()].sort((a, b) => a.localeCompare(b, 'pt'));
}
