import { choiceLabel, projectKinds, projectStages } from '../config/dataverse'
import { dateLabel, lookupName, personName } from '../data/projects'
import type { Lookups, Project } from '../data/projects'
import { Avatar, Icon } from './ui'

export function ProjectList({ projects, lookups, selectedId, archived, disabled = false, onSelect, onEdit, onClose, onRestore }: {
  projects: Project[]; lookups: Lookups; selectedId: string; archived: boolean; disabled?: boolean
  onSelect: (id: string) => void; onEdit: (project: Project) => void
  onClose: (project: Project) => void; onRestore: (project: Project) => void
}) {
  if (!projects.length) return <p className="empty">{archived ? 'The archive is empty.' : 'No active projects. Add your first project.'}</p>
  return <ul className="project-list">
    {projects.map(project => {
      const selected = selectedId === project.dredz_project1id
      const owner = lookupName(lookups.peopleNames, project._dredz_pm_owner_value)
      return <li key={project.dredz_project1id} className={`project-item ${selected ? 'selected' : ''}`}>
        <button className="project-card" aria-pressed={selected} onClick={() => onSelect(project.dredz_project1id)}>
          <span className="card-title">{project.dredz_pm_pinned && <span className="pin" title="Pinned"><Icon name="star" size={13} /></span>}{project.dredz_pm_name}</span>
          <span className="card-chips">
            <span className="chip chip-brand">{choiceLabel(projectStages, project.dredz_pm_stage)}</span>
            <span className="chip chip-neutral">{choiceLabel(projectKinds, project.dredz_pm_kind)}</span>
          </span>
          <span className="card-meta">
            {project._dredz_pm_clientid_value && <span>{lookupName(lookups.clientNames, project._dredz_pm_clientid_value)}</span>}
            {project._dredz_pm_productid_value && <span>Product: {lookupName(lookups.productNames, project._dredz_pm_productid_value)}</span>}
            <span><Icon name="calendar" size={13} /> {dateLabel(project.dredz_pm_enddate)}</span>
          </span>
          <span className="card-owner"><Avatar name={owner} size="sm" /><span>{owner === '—' ? 'No owner assigned' : personName(owner)}</span>
            <span className="muted card-activity" title="Last activity">Last activity: {dateLabel(project.dredz_pm_lastactivity)}</span></span>
        </button>
        <div className="project-actions">
          {!archived && <>
            <button className="icon-button" title="Edit" aria-label={`Edit ${project.dredz_pm_name}`} disabled={disabled} onClick={() => onEdit(project)}><Icon name="edit" size={16} /></button>
            <button className="icon-button" title="Close project" aria-label={`Close project ${project.dredz_pm_name}`} disabled={disabled} onClick={() => onClose(project)}><Icon name="archive" size={16} /></button>
          </>}
          {archived && <button className="icon-button" title="Restore" aria-label={`Restore ${project.dredz_pm_name}`} disabled={disabled} onClick={() => onRestore(project)}><Icon name="restore" size={16} /></button>}
        </div>
      </li>
    })}
  </ul>
}
