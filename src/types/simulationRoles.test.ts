import {
  ROLES,
  buildJoinLink,
  buildRoleLink,
  isSessionCode,
  parseJoinPath,
  parseRole,
} from './simulationRoles';

describe('simulationRoles', () => {
  it('parses known roles and rejects unknown ones', () => {
    expect(parseRole('station3_production')?.stationId).toBe(3);
    expect(parseRole('nope')).toBeNull();
    expect(parseRole(null)).toBeNull();
    expect(parseRole('customer')?.sub).toBeNull();
    expect(ROLES.map((info) => info.stationId)).toEqual([null, 1, 2, 3, 4, 5]);
  });

  it('builds a link with session and role', () => {
    expect(buildRoleLink('http://nas:50460', '4827', 'station1_lids')).toBe(
      'http://nas:50460/?session=4827&role=station1_lids'
    );
  });

  it('builds the single join link and parses it back', () => {
    expect(buildJoinLink('http://nas:50460', '4827')).toBe('http://nas:50460/join/4827');
    expect(parseJoinPath('/join/4827')).toBe('4827');
    expect(parseJoinPath('/join/4827/')).toBe('4827');
    expect(parseJoinPath('/join/48')).toBeNull();
    expect(parseJoinPath('/join/48271')).toBeNull();
    expect(parseJoinPath('/')).toBeNull();
  });
});

describe('isSessionCode', () => {
  it('accepts exactly four digits', () => {
    expect(isSessionCode('0000')).toBe(true);
    expect(isSessionCode('1234')).toBe(true);
  });

  it('rejects everything else', () => {
    for (const value of ['123', '12345', 'abcd', '12a4', '', ' ', ' 1234', '1234 ', '1234\n']) {
      expect(isSessionCode(value)).toBe(false);
    }
  });
});
