// Angular import
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { getAclLevel } from '../../../../../services/utility';

@Component({
  selector: 'app-nav-left',
  templateUrl: './nav-left.component.html',
  styleUrls: ['./nav-left.component.scss']
})
export class NavLeftComponent {
  // public props
  @Input() navCollapsed: boolean;
  @Output() NavCollapse = new EventEmitter();
  @Output() NavCollapsedMob = new EventEmitter();
  windowWidth: number;
  public aclLevel = getAclLevel();

  // Constructor
  constructor() {
    this.windowWidth = window.innerWidth;
  }

  // public method
  navCollapse() {
    this.NavCollapse.emit();
  }
}
