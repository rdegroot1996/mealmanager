import { Component } from '@angular/core';
import { UsersPage } from '../../../users/pages/users-page/users-page';
import { PicnicSettings } from '../../../picnic/components/picnic-settings';
@Component({
  selector: 'app-settings-page',
  imports: [UsersPage, PicnicSettings],
  templateUrl: './settings-page.html',
})
export class SettingsPage {}
