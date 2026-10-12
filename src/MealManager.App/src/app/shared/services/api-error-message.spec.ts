import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error-message';

describe('apiErrorMessage', () => {
  it('uses a ProblemDetails detail before generic fallback text', () => {
    expect(
      apiErrorMessage(
        new HttpErrorResponse({ error: { detail: 'Choose a later day.' }, status: 400 }),
      ),
    ).toBe('Choose a later day.');
  });

  it('does not expose unknown server response bodies', () => {
    expect(apiErrorMessage(new Error('internal details'), 'Try again.')).toBe('Try again.');
    expect(
      apiErrorMessage(
        new HttpErrorResponse({ error: '<html>Proxy failure details</html>', status: 502 }),
        'Try again.',
      ),
    ).toBe('Try again.');
  });

  it('uses stable problem codes outside the source locale', () => {
    const originalLanguage = document.documentElement.lang;
    document.documentElement.lang = 'nl-NL';
    try {
      expect(
        apiErrorMessage(
          new HttpErrorResponse({
            error: { code: 'LeftoverMustFollowOriginal', detail: 'English server detail.' },
            status: 400,
          }),
          'Fallback',
        ),
      ).toBe('Plan leftovers after their original meal.');
    } finally {
      document.documentElement.lang = originalLanguage;
    }
  });
});
