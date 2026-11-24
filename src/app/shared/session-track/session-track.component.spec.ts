import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionTrackComponent } from './session-track.component';

describe('SessionTrackComponent', () => {
  let fixture: ComponentFixture<SessionTrackComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SessionTrackComponent);
  });

  function nodeClasses(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.kz-track-node')).map(
      (el) => (el as HTMLElement).className,
    );
  }

  it('renders one node per total, marking everything before current as done and the rest ahead', () => {
    fixture.componentRef.setInput('total', 3);
    fixture.componentRef.setInput('current', 2);
    fixture.detectChanges();

    const classes = nodeClasses();
    expect(classes.length).toBe(3);
    expect(classes[0]).toContain('kz-track-node--done');
    expect(classes[1]).toContain('kz-track-node--current');
    expect(classes[2]).toContain('kz-track-node--ahead');
  });

  it('marks every node done when current is past the total (Practice Complete)', () => {
    fixture.componentRef.setInput('total', 3);
    fixture.componentRef.setInput('current', 4);
    fixture.detectChanges();

    const classes = nodeClasses();
    expect(classes.every((c) => c.includes('kz-track-node--done'))).toBe(true);
  });

  it('marks every node ahead for a brand-new session (current 1, nothing done yet)', () => {
    fixture.componentRef.setInput('total', 3);
    fixture.componentRef.setInput('current', 1);
    fixture.detectChanges();

    const classes = nodeClasses();
    expect(classes[0]).toContain('kz-track-node--current');
    expect(classes[1]).toContain('kz-track-node--ahead');
    expect(classes[2]).toContain('kz-track-node--ahead');
  });

  it('shows the optional trailing label only when provided', () => {
    fixture.componentRef.setInput('total', 3);
    fixture.componentRef.setInput('current', 1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kz-track-label')).toBeNull();

    fixture.componentRef.setInput('label', '3 exercises');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.kz-track-label')?.textContent?.trim()).toBe('3 exercises');
  });

  it('respects a fewer-than-default count instead of padding to a fixed size', () => {
    fixture.componentRef.setInput('total', 2);
    fixture.componentRef.setInput('current', 1);
    fixture.detectChanges();

    expect(nodeClasses().length).toBe(2);
  });
});
