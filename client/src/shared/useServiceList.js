import { useQuery } from '@tanstack/react-query';

/**
 * The admin's service list (Settings → Services), shared by client profiles and invoice lines.
 * server/services/serviceCatalog.js — an invoice line with no service counts as "Unassigned".
 * @param http  axios instance of the panel in use
 * @param base  API root of the CRM routes (e.g. '/admin')
 */
export function useServiceList(http, base) {
  const { data } = useQuery({
    queryKey: ['service-catalog', base],
    queryFn: () => http.get(`${base}/service-catalog`).then((r) => r.data.services || []),
    staleTime: 5 * 60 * 1000,
  });
  return data || [];
}
