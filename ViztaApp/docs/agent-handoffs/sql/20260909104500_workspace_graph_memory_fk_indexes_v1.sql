-- Cover the composite Space foreign keys in their declared column order.

create index space_groups_space_owner_fk_idx
  on public.space_groups (space_id, user_id);

create index workspace_graph_edges_space_owner_fk_idx
  on public.workspace_graph_edges (space_id, user_id);
