import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Map as ShudanMap, Vertex } from '@sabaki/shudan';
import { GobanAdapterComponent, type VertexClass } from './goban-adapter.component';

function emptyBoard(size: number): ShudanMap<0 | 1 | -1> {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => 0 as const));
}

@Component({
  selector: 'kz-test-host',
  imports: [GobanAdapterComponent],
  template: `
    @if (mounted()) {
      <div class="kz-board kz-board--kaya">
        <kz-goban-adapter
          [signMap]="signMap()"
          [vertexClasses]="vertexClasses()"
          [interactive]="interactive()"
          (vertexClick)="lastClick.set($event)"
        />
      </div>
    }
  `,
})
class TestHostComponent {
  readonly mounted = signal(true);
  readonly signMap = signal(emptyBoard(9));
  readonly vertexClasses = signal<VertexClass[]>([]);
  readonly interactive = signal(true);
  readonly lastClick = signal<Vertex | null>(null);
}

describe('GobanAdapterComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('mounts Shudan into its own host element', () => {
    const vertices = fixture.nativeElement.querySelectorAll('.shudan-vertex');
    expect(vertices.length).toBe(81); // 9x9
  });

  it('emits the tapped vertex on click, matching the real tap/click path on mobile', async () => {
    const el = fixture.nativeElement.querySelector('.shudan-vertex[data-x="3"][data-y="4"]') as HTMLElement;
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.lastClick()).toEqual([3, 4]);
  });

  it('labels empty points for assistive tech and leaves occupied points unlabelled', async () => {
    const board = emptyBoard(9);
    board[0][0] = 1;
    fixture.componentInstance.signMap.set(board);
    fixture.detectChanges();
    await fixture.whenStable();

    const occupied = fixture.nativeElement.querySelector('.shudan-vertex[data-x="0"][data-y="0"]') as HTMLElement;
    const empty = fixture.nativeElement.querySelector('.shudan-vertex[data-x="1"][data-y="0"]') as HTMLElement;

    expect(occupied.getAttribute('role')).toBeNull();
    expect(empty.getAttribute('role')).toBe('button');
    expect(empty.getAttribute('aria-label')).toContain('Play');
  });

  it('re-renders when signMap changes (update)', async () => {
    const board = emptyBoard(9);
    board[2][2] = -1;
    fixture.componentInstance.signMap.set(board);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement.querySelector('.shudan-vertex[data-x="2"][data-y="2"]');
    expect(el.classList.contains('shudan-sign_-1')).toBe(true);
  });

  it('renders stones as circles, not squares (regression: goban-theme.scss must set border-radius on .shudan-stone-image itself)', async () => {
    const board = emptyBoard(9);
    board[2][2] = 1;
    fixture.componentInstance.signMap.set(board);
    fixture.detectChanges();
    await fixture.whenStable();

    const stoneImage = fixture.nativeElement.querySelector(
      '.shudan-vertex[data-x="2"][data-y="2"] .shudan-stone-image'
    ) as HTMLElement;
    expect(getComputedStyle(stoneImage).borderRadius).not.toBe('0px');
  });

  it('applies a vertex class, e.g. the last-move marker', async () => {
    fixture.componentInstance.vertexClasses.set([{ vertex: [5, 5], className: 'kz-last-move' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = fixture.nativeElement.querySelector('.shudan-vertex[data-x="5"][data-y="5"]');
    expect(el.classList.contains('kz-last-move')).toBe(true);
  });

  it('unmounts the Preact tree on destroy, leaving no Shudan DOM behind', async () => {
    fixture.componentInstance.mounted.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('.shudan-goban')).toBeNull();
  });

  it('locks the board when interactive is false: no role/tabindex, aria-disabled, and a locked class (Mobile-UX fix)', async () => {
    fixture.componentInstance.interactive.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('kz-goban-adapter') as HTMLElement;
    expect(host.classList.contains('kz-goban-adapter--locked')).toBe(true);

    const vertex = fixture.nativeElement.querySelector('.shudan-vertex[data-x="4"][data-y="4"]') as HTMLElement;
    expect(vertex.getAttribute('role')).toBeNull();
    expect(vertex.getAttribute('tabindex')).toBeNull();
    expect(vertex.getAttribute('aria-disabled')).toBe('true');
  });

  it('unlocks the board again when interactive flips back to true', async () => {
    fixture.componentInstance.interactive.set(false);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.interactive.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    const host = fixture.nativeElement.querySelector('kz-goban-adapter') as HTMLElement;
    expect(host.classList.contains('kz-goban-adapter--locked')).toBe(false);

    const vertex = fixture.nativeElement.querySelector('.shudan-vertex[data-x="4"][data-y="4"]') as HTMLElement;
    expect(vertex.getAttribute('role')).toBe('button');
    expect(vertex.getAttribute('aria-disabled')).toBeNull();
  });
});
