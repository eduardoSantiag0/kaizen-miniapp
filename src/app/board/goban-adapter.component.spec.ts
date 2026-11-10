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

  it('draws the wrong-move cross with a symmetric, self-contained box — even when the vertex is also last-move (regression)', async () => {
    const board = emptyBoard(9);
    board[2][2] = 1;
    fixture.componentInstance.signMap.set(board);
    // A wrong move is always the last move too, so both classes land on the
    // same vertex in practice — this exact combination is what let the
    // .kz-last-move ::after rule's width/height/transform (meant for its own
    // differently-sized dot) leak into .kz-wrong's cross and drag it visibly
    // off-center, even though .kz-wrong's own inset was perfectly symmetric.
    fixture.componentInstance.vertexClasses.set([
      { vertex: [2, 2], className: 'kz-last-move' },
      { vertex: [2, 2], className: 'kz-wrong' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const stone = fixture.nativeElement.querySelector(
      '.shudan-vertex[data-x="2"][data-y="2"] .shudan-stone'
    ) as HTMLElement;
    const after = getComputedStyle(stone, '::after');

    // A font-glyph cross (the old '\2715' approach) has no such guarantee —
    // ink isn't centered in the glyph's own em-box. A gradient-drawn cross
    // only needs a symmetric inset and no stray transform to land dead-center.
    expect(after.content).not.toContain('2715');
    expect(after.top).toBe(after.bottom);
    expect(after.left).toBe(after.right);
    expect(after.width).toBe(after.height);
    expect(after.transform).toBe('none');
  });

  it('removes a stale vertex class once it stops being passed, even when Shudan itself has no reason to touch that vertex (regression)', async () => {
    fixture.componentInstance.vertexClasses.set([{ vertex: [5, 5], className: 'kz-test-overlay' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    let el = fixture.nativeElement.querySelector('.shudan-vertex[data-x="5"][data-y="5"]') as HTMLElement;
    expect(el.classList.contains('kz-test-overlay')).toBe(true);

    // signMap is untouched, so Shudan's own computed output for this vertex is
    // identical across these two renders — this is exactly the "stone stays the
    // same sign, only our own overlay class changes" case that triggered the bug.
    fixture.componentInstance.vertexClasses.set([]);
    fixture.detectChanges();
    await fixture.whenStable();

    el = fixture.nativeElement.querySelector('.shudan-vertex[data-x="5"][data-y="5"]') as HTMLElement;
    expect(el.classList.contains('kz-test-overlay')).toBe(false);
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
