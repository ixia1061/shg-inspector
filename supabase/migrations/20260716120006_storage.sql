-- 점검 사진 저장 버킷 (비공개, 서명 URL로만 접근)
insert into storage.buckets (id, name, public)
values ('inspection-photos', 'inspection-photos', false)
on conflict (id) do nothing;

-- MVP는 로그인 사용자 전체에게 업로드/조회를 허용한다.
-- (DB 쪽 inspection_photos 테이블 RLS가 실제 열람 가능 여부를 이미 통제하므로,
--  스토리지 경로 단위의 세밀한 제한은 이후 하드닝 항목으로 남긴다.)
create policy "inspection_photos_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'inspection-photos');

create policy "inspection_photos_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'inspection-photos');
