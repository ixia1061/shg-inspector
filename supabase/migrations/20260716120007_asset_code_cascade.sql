-- 1) 버그 수정: asset_code 변경 이력 트리거가 "update of asset_code"로 걸려 있어
--    UPDATE 문의 SET 절에 asset_code가 명시된 경우에만 발화했다.
--    (소화기 위치 이동처럼 BEFORE 트리거가 asset_code를 바꾸는 경우에는 발화하지 않아 이력 누락)
--    컬럼 제한 없이 모든 UPDATE에서 발화하도록 재생성한다. 함수 내부에서
--    old/new asset_code가 실제로 다를 때만 기록하므로 불필요한 이력은 남지 않는다.
drop trigger if exists trg_log_asset_code_change on public.extinguishers;
create trigger trg_log_asset_code_change
  after update on public.extinguishers
  for each row execute function public.fn_log_asset_code_change();

-- 2) 위치 마스터(조직코드/건물번호/층코드/차량번호) 변경 시 소속 소화기의 asset_code를
--    자동 재계산한다. extinguisher_no를 제자리 갱신(touch)하면 extinguishers의
--    BEFORE 트리거(fn_set_extinguisher_asset_code)가 발화해 asset_code를 다시 조합하고,
--    위에서 고친 이력 트리거가 이전 관리번호를 asset_code_history에 남긴다.

create or replace function public.fn_cascade_asset_code_from_site()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.org_code is distinct from old.org_code then
    update public.extinguishers e set extinguisher_no = e.extinguisher_no
    where e.floor_id in (
      select f.id from public.floors f
      join public.buildings b on b.id = f.building_id
      where b.site_id = new.id
    )
    or e.vehicle_id in (select v.id from public.vehicles v where v.site_id = new.id);
  end if;
  return new;
end;
$$;

create trigger trg_cascade_asset_code_site
  after update of org_code on public.sites
  for each row execute function public.fn_cascade_asset_code_from_site();

create or replace function public.fn_cascade_asset_code_from_building()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.building_no is distinct from old.building_no then
    update public.extinguishers e set extinguisher_no = e.extinguisher_no
    where e.floor_id in (select f.id from public.floors f where f.building_id = new.id);
  end if;
  return new;
end;
$$;

create trigger trg_cascade_asset_code_building
  after update of building_no on public.buildings
  for each row execute function public.fn_cascade_asset_code_from_building();

create or replace function public.fn_cascade_asset_code_from_floor()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.floor_code is distinct from old.floor_code then
    update public.extinguishers e set extinguisher_no = e.extinguisher_no
    where e.floor_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_cascade_asset_code_floor
  after update of floor_code on public.floors
  for each row execute function public.fn_cascade_asset_code_from_floor();

create or replace function public.fn_cascade_asset_code_from_vehicle()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.vehicle_no is distinct from old.vehicle_no then
    update public.extinguishers e set extinguisher_no = e.extinguisher_no
    where e.vehicle_id = new.id;
  end if;
  return new;
end;
$$;

create trigger trg_cascade_asset_code_vehicle
  after update of vehicle_no on public.vehicles
  for each row execute function public.fn_cascade_asset_code_from_vehicle();
