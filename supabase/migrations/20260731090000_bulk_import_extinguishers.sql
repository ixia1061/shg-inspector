-- 소화기 엑셀 일괄 등록
--
-- 왜 DB 함수인가 (앱에서 insert를 반복하지 않는 이유)
--   1) 원자성 — 건물·층·차량을 새로 만들다가 소화기 삽입이 실패하면 빈 건물만 남는다.
--      함수는 호출자의 트랜잭션 안에서 돌므로 예외 하나면 전부 되돌아간다.
--   2) 채번 — fn_set_extinguisher_asset_code가 max(extinguisher_no)+1로 번호를 매기는데,
--      여러 행을 한 statement로 넣으면 트리거가 같은 statement의 앞 행을 못 봐서
--      같은 번호가 매겨질 수 있다. 아래처럼 한 행씩 넣어야 순차 채번이 보장된다.
--
-- security invoker — RLS가 호출자 기준으로 적용된다. 담당 사업장이 아니면 건물/층 insert가
-- 막히고, 담당 파트가 아니면 소화기 insert가 막힌다. 경계를 여기서 다시 구현하지 않는다.

create or replace function public.fn_bulk_import_extinguishers(
  p_site_id uuid,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row          jsonb;
  v_idx          int := 0;
  v_part_id      uuid;
  v_part_code    text;
  v_type_id      uuid;
  v_building_id  uuid;
  v_building_no  int;
  v_floor_id     uuid;
  v_vehicle_id   uuid;
  v_vehicle_no   int;
  v_floor_code   text;
  v_plate_no     text;
  v_ext_no       int;
  v_expect_code  text;
  v_inserted     int := 0;
  v_skipped      jsonb := '[]'::jsonb;
  v_new_bld      int := 0;
  v_new_flr      int := 0;
  v_new_veh      int := 0;
begin
  if not is_admin() then
    raise exception '관리자만 일괄 등록할 수 있습니다';
  end if;
  if not has_site_access(p_site_id) then
    raise exception '담당하지 않는 사업장입니다';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception '등록할 행 목록이 배열이 아닙니다';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_idx := v_idx + 1;

    -- 관리파트 — 쓰기가 시스템관리자 전용이라 여기서 만들지 않는다. 없으면 오류.
    select mp.id, mp.code into v_part_id, v_part_code
    from public.management_parts mp
    where mp.site_id = p_site_id
      and (mp.code = (v_row ->> 'part') or mp.name = (v_row ->> 'part'))
    order by (mp.code = (v_row ->> 'part')) desc
    limit 1;
    if v_part_id is null then
      raise exception '% 행: 관리파트 "%"를 찾을 수 없습니다', v_idx, (v_row ->> 'part');
    end if;

    -- 소화기 종류 — 종류 마스터도 임의 생성하지 않는다(오타가 새 종류를 만들면 통계가 깨진다).
    select et.id into v_type_id
    from public.extinguisher_types et
    where et.name = (v_row ->> 'type_name')
    limit 1;
    if v_type_id is null then
      raise exception '% 행: 소화기 종류 "%"를 찾을 수 없습니다', v_idx, (v_row ->> 'type_name');
    end if;

    -- 건물 — 번호로 찾고 없으면 만든다(대장에 새 동이 추가되는 경우).
    v_building_no := (v_row ->> 'building_no')::int;
    select b.id into v_building_id
    from public.buildings b
    where b.site_id = p_site_id and b.building_no = v_building_no;

    if v_building_id is null then
      insert into public.buildings (site_id, building_no, name)
      values (p_site_id, v_building_no, nullif(v_row ->> 'building_name', ''))
      returning id into v_building_id;
      v_new_bld := v_new_bld + 1;
    end if;

    if (v_row ->> 'location_type') = 'VEHICLE' then
      v_plate_no := nullif(v_row ->> 'plate_no', '');
      if v_plate_no is null then
        raise exception '% 행: 차량 소화기는 차량번호판이 필요합니다', v_idx;
      end if;

      select v.id into v_vehicle_id
      from public.vehicles v
      where v.building_id = v_building_id and v.plate_no = v_plate_no;

      if v_vehicle_id is null then
        select coalesce(max(v.vehicle_no), 0) + 1 into v_vehicle_no
        from public.vehicles v where v.building_id = v_building_id;

        insert into public.vehicles (building_id, vehicle_no, plate_no, name, department)
        values (v_building_id, v_vehicle_no, v_plate_no,
                nullif(v_row ->> 'vehicle_name', ''), nullif(v_row ->> 'department', ''))
        returning id into v_vehicle_id;
        v_new_veh := v_new_veh + 1;
      end if;

      v_floor_id := null;
      v_floor_code := '차';
    else
      v_floor_code := v_row ->> 'floor_code';
      if coalesce(v_floor_code, '') = '' then
        raise exception '% 행: 건물 소화기는 층이 필요합니다', v_idx;
      end if;

      select f.id into v_floor_id
      from public.floors f
      where f.building_id = v_building_id and f.floor_code = v_floor_code;

      if v_floor_id is null then
        insert into public.floors (building_id, floor_code, name, order_index)
        values (
          v_building_id, v_floor_code,
          coalesce(nullif(v_row ->> 'floor_name', ''), v_floor_code || '층'),
          coalesce((select max(f2.order_index) + 1 from public.floors f2
                     where f2.building_id = v_building_id), 0)
        )
        returning id into v_floor_id;
        v_new_flr := v_new_flr + 1;
      end if;

      v_vehicle_id := null;
    end if;

    -- 관리번호 끝자리를 지정한 행은 이미 등록됐는지 본다. 비운 행은 정의상 신규(자동 채번).
    v_ext_no := nullif(v_row ->> 'extinguisher_no', '')::int;
    if v_ext_no is not null then
      v_expect_code := v_part_code || '-' || v_building_no || '-' || v_floor_code || '-' || v_ext_no;
      if exists (select 1 from public.extinguishers e where e.asset_code = v_expect_code) then
        v_skipped := v_skipped || jsonb_build_object('row', v_idx, 'asset_code', v_expect_code);
        continue;
      end if;
    end if;

    insert into public.extinguishers (
      location_type, floor_id, vehicle_id, part_id, extinguisher_no,
      extinguisher_type_id, manufacture_date, useful_life_years,
      capacity, install_note, serial_no, status
    )
    values (
      v_row ->> 'location_type',
      v_floor_id,
      v_vehicle_id,
      v_part_id,
      v_ext_no,
      v_type_id,
      (v_row ->> 'manufacture_date')::date,
      coalesce(
        nullif(v_row ->> 'useful_life_years', '')::int,
        (select et.default_useful_life_years from public.extinguisher_types et where et.id = v_type_id)
      ),
      nullif(v_row ->> 'capacity', ''),
      nullif(v_row ->> 'install_note', ''),
      nullif(v_row ->> 'serial_no', ''),
      'active'
    );
    v_inserted := v_inserted + 1;
  end loop;

  return jsonb_build_object(
    'inserted', v_inserted,
    'skipped', v_skipped,
    'created_buildings', v_new_bld,
    'created_floors', v_new_flr,
    'created_vehicles', v_new_veh
  );
end;
$$;

comment on function public.fn_bulk_import_extinguishers(uuid, jsonb) is
  '소화기 엑셀 일괄 등록. 건물/층/차량은 없으면 생성, 관리파트·종류는 없으면 오류. '
  '관리번호 끝자리를 지정한 행 중 이미 있는 것은 건너뛴다. 실패 시 전부 롤백.';

grant execute on function public.fn_bulk_import_extinguishers(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
