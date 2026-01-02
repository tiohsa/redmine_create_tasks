/**
 * Gets the CSRF token from the meta tag in the HTML document.
 * Required for POST/PUT/DELETE requests to Rails backend.
 */
export const getCsrfToken = (): string => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    return meta?.content ?? '';
};

/**
 * Returns common headers for API requests including CSRF token.
 */
export const getApiHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken()
});
