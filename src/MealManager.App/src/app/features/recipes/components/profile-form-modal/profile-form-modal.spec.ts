import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ProductRow } from '../../../../shared/components/product-row/product-row';
import { Subject, of, throwError } from 'rxjs';
import { ProfileFormModal } from './profile-form-modal';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ApiRecipeProduct, ApiRecipeProfile } from '../../../../api/models/api-recipe';

describe('ProfileFormModal', () => {
  let component: ProfileFormModal;
  let fixture: ComponentFixture<ProfileFormModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ProfileFormModal] }).compileComponents();
    fixture = TestBed.createComponent(ProfileFormModal);
    component = fixture.componentInstance;
  });

  it('adds new products directly to the chosen section', () => {
    component.addItem({ name: 'Pasta sauce', quantity: 2 }, false);
    component.addItem({ name: 'Salt', quantity: 1 }, true);

    expect(component.neededItems()[0]).toEqual(
      expect.objectContaining({ name: 'Pasta sauce', quantity: 2, atHome: false }),
    );
    expect(component.atHomeItems()[0]).toEqual(
      expect.objectContaining({ name: 'Salt', quantity: 1, atHome: true }),
    );
  });

  function openEditor(existing?: ApiRecipeProfile) {
    fixture.detectChanges();
    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    return component.open(existing);
  }

  it('saves servings and groceries together while keeping product identities and order', () => {
    const existing = profile('profile-1', 'Pasta');
    openEditor(existing);
    component.profileName.set('Family');
    component.profileServings.set(6);
    component.updateNeededItem(0, { name: 'Pasta', quantity: 3 });
    component.addItem({ name: 'Salt', quantity: 1 }, true);
    const save = vi.fn((updated: ApiRecipeProfile) => of(updated));
    component.onSave = save;
    vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    component.confirm();
    expect(save).toHaveBeenCalledWith({
      id: existing.id,
      name: 'Family',
      servings: 6,
      products: [
        { ...existing.products[0], quantity: 3, order: 0 },
        expect.objectContaining({ name: 'Salt', quantity: 1, atHome: true, order: 1 }),
      ],
    });
  });

  it('starts a new profile with the recipe servings and can initialize grocery names', () => {
    openEditor();
    component.open(
      undefined,
      undefined,
      [{ id: 'ingredient', name: 'Pasta', quantity: 500, unit: 'g', order: 0 }],
      6,
    );
    component.initializeFromIngredients();
    expect(component.profileServings()).toBe(6);
    expect(component.neededItems()[0]).toEqual(
      expect.objectContaining({ name: 'Pasta', quantity: 1 }),
    );
  });

  it('validates the name and servings before saving', () => {
    openEditor();
    const save = vi.fn();
    component.onSave = save;
    component.confirm();
    expect(component.error()).toBe('Profile name is required.');
    component.profileName.set('Family');
    component.profileServings.set(0);
    component.confirm();
    expect(component.error()).toBe('Servings must be a positive whole number.');
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps all draft changes after a save failure', () => {
    openEditor(profile('profile-1', 'Pasta'));
    component.profileName.set('Family');
    component.profileServings.set(6);
    component.onSave = () => throwError(() => new Error('Failed'));
    component.confirm();
    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('The profile could not be saved.');
    expect(component.profileName()).toBe('Family');
    expect(component.profileServings()).toBe(6);
    expect(component.neededItems()).toHaveLength(1);
  });

  it('does not close a newer session when an older save finishes', () => {
    const first = profile('first', 'Pasta');
    openEditor(first);
    const close = vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    const saved = new Subject<ApiRecipeProfile>();
    component.onSave = () => saved;
    component.confirm();
    component.open(profile('second', 'Rice'));
    saved.next(first);
    expect(close).not.toHaveBeenCalled();
    expect(component.profileName()).toBe('second');
    expect(component.neededItems()[0].name).toBe('Rice');
  });

  it('does not accept product changes while groceries are saving', () => {
    component.neededItems.set([
      { id: 'product-1', name: 'Pasta', quantity: 1, atHome: false, order: 0 },
    ]);
    component.saving.set(true);

    component.addItem({ name: 'Sauce', quantity: 1 }, false);
    component.updateNeededItem(0, { name: 'Rice', quantity: 2 });
    component.removeNeededItem(0);

    expect(component.neededItems()).toEqual([
      { id: 'product-1', name: 'Pasta', quantity: 1, atHome: false, order: 0 },
    ]);
  });

  it('moves products between sections with the keyboard', () => {
    const product = { id: 'product-1', name: 'Pasta', quantity: 1, atHome: false, order: 0 };
    component.neededItems.set([product]);

    component.moveItemWithKeyboard(product, 1);

    expect(component.neededItems()).toEqual([]);
    expect(component.atHomeItems()[0]).toEqual(
      expect.objectContaining({ id: product.id, atHome: true }),
    );
    expect(component.reorderAnnouncement()).toContain('position 1');
  });

  it('shows a scoped add action for each grocery section', () => {
    component.profile.set({ id: 'profile-1', name: 'Default', servings: 4, products: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Add item to Needed"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Add item to Usually at home"]'),
    ).not.toBeNull();
  });

  it('shows empty-profile guidance only while an editor draft exists', () => {
    component.profile.set({ id: 'profile-1', name: 'Default', servings: 4, products: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(
      'This profile has no grocery products yet.',
    );
    component.profile.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'This profile has no grocery products yet.',
    );
  });

  it('keeps both drop zones visible and moves a product between them', () => {
    const pasta = { id: 'product-1', name: 'Pasta', quantity: 1, atHome: false, order: 0 };
    component.profile.set({ id: 'profile-1', name: 'Default', servings: 4, products: [pasta] });
    component.neededItems.set([pasta]);
    component.atHomeItems.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Usually at home');
    component.dropItem(
      {
        previousContainer: { data: component.neededItems() },
        container: { data: component.atHomeItems() },
        previousIndex: 0,
        currentIndex: 0,
      } as CdkDragDrop<ApiRecipeProduct[]>,
      true,
    );

    expect(component.neededItems()).toEqual([]);
    expect(component.atHomeItems()).toEqual([{ ...pasta, atHome: true }]);
  });

  it('keeps editing state attached to a product after reordering', () => {
    const first = { id: 'a', name: 'A', quantity: 1, atHome: false };
    const second = { id: 'b', name: 'B', quantity: 1, atHome: false };
    component.profile.set(profile('p', 'P'));
    component.neededItems.set([first, second]);
    fixture.detectChanges();
    const row = fixture.debugElement.queryAll(By.directive(ProductRow))[0]
      .componentInstance as ProductRow;
    const dialog = row.editor().modal().dialog().nativeElement;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    row.startEditing();
    component.neededItems.set([second, first]);
    fixture.detectChanges();
    const reordered = fixture.debugElement.queryAll(By.directive(ProductRow));
    expect(reordered[1].componentInstance).toBe(row);
    expect(row.item().id).toBe('a');
    expect(row.editor().modal().dialog().nativeElement.open).toBe(true);
    expect(reordered[0].componentInstance.editor().modal().dialog().nativeElement.open).toBe(false);
  });

  function profile(id: string, productName: string): ApiRecipeProfile {
    return {
      id,
      name: id,
      servings: 4,
      products: [{ id: `${id}-product`, name: productName, quantity: 1, atHome: false }],
    };
  }
});
