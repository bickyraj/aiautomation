import { Component } from '@angular/core';

@Component({
  selector: 'app-overview',
  standalone: true,
  templateUrl: './overview.html',
  styleUrl: './overview.scss'
})
export class Overview {
  readonly stats = [
    { label: 'Total agents', value: '04', note: 'Configured roles', icon: '◈' },
    { label: 'Active workflows', value: '02', note: 'Ready to run', icon: '⌘' },
    { label: 'Executions today', value: '12', note: 'Across all workflows', icon: '◷' },
    { label: 'Pending approvals', value: '01', note: 'Awaiting your review', icon: '✓' }
  ];

  readonly agents = [
    { name: 'Figma Design Agent', role: 'Design analysis & specifications', status: 'Configured', initials: 'F', color: 'sage' },
    { name: 'SwiftUI Coding Agent', role: 'Implementation & code generation', status: 'Draft', initials: 'S', color: 'blue' },
    { name: 'Testing Agent', role: 'Build verification & testing', status: 'Draft', initials: 'T', color: 'amber' }
  ];
}
