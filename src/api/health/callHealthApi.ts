import requestApi from '../requestApi';

export default function callHealthApi() {
  return requestApi<Record<string, unknown>>('/health', { withAuth: false });
}
