import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExerciseContextComponent } from './exercise-context.component';

describe('ExerciseContextComponent', () => {
  let fixture: ComponentFixture<ExerciseContextComponent>;

  function create(): ComponentFixture<ExerciseContextComponent> {
    fixture = TestBed.createComponent(ExerciseContextComponent);
    fixture.componentRef.setInput('turnText', 'Black to move');
    fixture.componentRef.setInput('metaText', 'vs opponent');
    fixture.componentRef.setInput('step', 1);
    fixture.componentRef.setInput('totalSteps', 3);
    return fixture;
  }

  function backButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('.kz-back');
  }

  it('hides the back button by default', () => {
    create().detectChanges();
    expect(backButton()).toBeNull();
  });

  it('shows an in-page back button when showBack is true, and emits back on click', () => {
    create();
    fixture.componentRef.setInput('showBack', true);
    fixture.detectChanges();

    const button = backButton();
    expect(button).toBeTruthy();

    const events: void[] = [];
    fixture.componentInstance.back.subscribe(() => events.push(undefined));
    button!.click();

    expect(events.length).toBe(1);
  });
});
