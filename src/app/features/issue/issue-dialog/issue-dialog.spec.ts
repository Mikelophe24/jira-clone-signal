import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IssueDialog } from './issue-dialog';

describe('IssueDialog', () => {
  let component: IssueDialog;
  let fixture: ComponentFixture<IssueDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IssueDialog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IssueDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
