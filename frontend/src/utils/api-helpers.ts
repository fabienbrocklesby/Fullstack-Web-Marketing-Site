import type { Page, APIResponse, APIError } from '../types/site-editor';

const CMS_URL = document.documentElement.getAttribute('data-cms-url') || 'http://localhost:1337';

/**
 * Get authentication headers for API requests
 */
function getAuthHeaders(): Headers {
  const jwt = localStorage.getItem('jwt');
  if (!jwt) {
    throw new Error('User not authenticated');
  }
  
  return new Headers({
    'Authorization': `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  });
}

/**
 * Handle API response and errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData: APIError = await response.json().catch(() => ({
      error: {
        status: response.status,
        name: 'UnknownError',
        message: 'An unknown error occurred',
      }
    }));
    throw new Error(errorData.error.message || `HTTP ${response.status}`);
  }
  
  const data: APIResponse<T> = await response.json();
  return data.data;
}

/**
 * Fetch a single page with populated sections
 */
export async function fetchPage(id: number): Promise<Page> {
  try {
    const response = await fetch(`${CMS_URL}/api/pages/${id}?populate=sections`, {
      headers: getAuthHeaders(),
    });
    
    return await handleResponse<Page>(response);
  } catch (error) {
    console.error('Error fetching page:', error);
    throw new Error(`Failed to fetch page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fetch all pages (for selection)
 */
export async function fetchPages(): Promise<Page[]> {
  try {
    const response = await fetch(`${CMS_URL}/api/pages?populate=sections`, {
      headers: getAuthHeaders(),
    });
    
    return await handleResponse<Page[]>(response);
  } catch (error) {
    console.error('Error fetching pages:', error);
    throw new Error(`Failed to fetch pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update a page with new sections data
 */
export async function updatePage(id: number, sections: any[]): Promise<Page> {
  try {
    const response = await fetch(`${CMS_URL}/api/pages/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: {
          sections,
        },
      }),
    });
    
    return await handleResponse<Page>(response);
  } catch (error) {
    console.error('Error updating page:', error);
    throw new Error(`Failed to update page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a new page
 */
export async function createPage(title: string, slug: string, sections: any[] = []): Promise<Page> {
  try {
    const response = await fetch(`${CMS_URL}/api/pages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: {
          title,
          slug,
          sections,
          publishedAt: new Date().toISOString(),
        },
      }),
    });
    
    return await handleResponse<Page>(response);
  } catch (error) {
    console.error('Error creating page:', error);
    throw new Error(`Failed to create page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a page
 */
export async function deletePage(id: number): Promise<void> {
  try {
    const response = await fetch(`${CMS_URL}/api/pages/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting page:', error);
    throw new Error(`Failed to delete page: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
