import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MOCK_MODE } from '@/lib/env';
import { mockData } from '@/lib/mock';
import { useAuth } from '@/providers/AuthProvider';
import type { NotificationRow } from '@/types/db';

/**
 * Live notifications feed for the signed-in user. Loads recent items, then subscribes
 * to Realtime INSERTs so new notifications (cover ready, premium activated, etc.) appear
 * instantly without polling.
 */
export function useNotifications() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    if (MOCK_MODE) {
      setItems(mockData.notifications());
      return;
    }
    if (!userId) {
      setItems([]);
      return;
    }

    void supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setItems(data as NotificationRow[]);
      });

    const channel = supabase
      .channel(`notif:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => setItems((prev) => [payload.new as NotificationRow, ...prev]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) =>
          setItems((prev) =>
            prev.map((n) => (n.id === (payload.new as NotificationRow).id ? (payload.new as NotificationRow) : n)),
          ),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    if (MOCK_MODE) {
      mockData.markNotifRead(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
      return;
    }
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
  }, []);

  const unreadCount = items.filter((n) => !n.read_at).length;

  return { items, unreadCount, markRead };
}
