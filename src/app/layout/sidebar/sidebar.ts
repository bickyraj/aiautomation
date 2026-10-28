import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss'
})
export class Sidebar {
  readonly navigation = [
    { label: 'Overview', icon: '⌂', route: '/overview' },
    { label: 'Agents', icon: '◈', route: '/agents' },
    { label: 'Workflows', icon: '⌘', route: '/workflows' },
    { label: 'Connections', icon: '↔', route: '/connections' },
    { label: 'Executions', icon: '◷', route: '/executions' },
    { label: 'Approvals', icon: '✓', route: '/approvals' }
  ];
}
