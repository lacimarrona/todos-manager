import { Pipe, PipeTransform } from '@angular/core';
import { ItemRevision } from '../core/models/models';

@Pipe({ name: 'done', standalone: true })
export class DonePipe implements PipeTransform {
  transform(items: ItemRevision[]): number {
    return items?.filter(i => i.checked).length || 0;
  }
}