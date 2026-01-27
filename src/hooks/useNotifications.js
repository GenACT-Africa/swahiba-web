import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export function useNotifications(limit = 20) {
  const [me, setMe] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setMe(data?.user ?? null);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!me?.id) return;

    let channel;

    const load = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, type, title, body, ref_table, ref_id, is_read, created_at")
        .eq("user_id", me.id)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!error) {
        setItems(data || []);
        setUnread((data || []).filter(n => !n.is_read).length);
      }
    };

    load();

    channel = supabase
      .channel(`notif:${me.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [me?.id, limit]);

  const markAsRead = async (id) => {
    if (!me?.id) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", me.id);
  };

  const markAllRead = async () => {
    if (!me?.id) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", me.id).eq("is_read", false);
  };

  return { me, items, unread, markAsRead, markAllRead };
}