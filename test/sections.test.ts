import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBasics, parsePersonal, parseSections, sectionBodies, basicsProfile, personalProfile } from '../src/naukri/sections.ts';

// Records as Naukri's full profile returns them (trimmed), and the save shapes its profile page sends.
const full = {
  profile: [
    {
      name: 'Sanjeev',
      city: { id: 17, value: 'Hyderabad', subValue: '' },
      experience: { month: '6', year: '3' },
      currency: 'INR',
      absoluteCtc: '750000',
      birthDate: '2000-09-14',
      gender: 'M',
      maritalStatus: { id: 'N', value: 'Single/unmarried' },
      contactAddress: null,
      mailCity: '',
      pincode: null,
    },
  ],
  employments: [
    {
      designation: 'Software Engineer 2',
      designationId: '5555',
      employmentType: 'current',
      endDate: null,
      jobDescription: 'Full stack',
      organization: '7EDGE',
      organizationId: '4719567',
      startDate: '2025-11-01',
      employmentId: 'emp1',
      keySkills: 'React.js, Node.js',
      experienceType: 'F',
    },
  ],
  itskills: [{ experienceTime: { month: 5, year: 3 }, lastUsed: { id: 2026, value: 2026 }, version: '19', entitySkill: 'React.js', entitySkillId: '56097', skillId: 'sk1' }],
  educations: [
    {
      courseType: 'F',
      course: { id: 12, value: 'B.Tech / B.E.' },
      specialisation: { id: 550, value: 'Computer Science and Engineering (CSE)' },
      educationType: { id: 1, value: 'UG' },
      grade: { id: 1, value: 'Scale 10 Grading System' },
      marks: '8',
      educationId: 'ed1',
      yearOfStart: 2020,
      yearOfCompletion: 2023,
      entityInstitute: { id: 'PG725218', value: 'Dr. Mahalingam College' },
      isPrimary: 1,
    },
  ],
  onlineProfile: [{ description: '', profile: 'LinkedIn', url: 'https://www.linkedin.com/in/x', id: 'op1' }],
  workSample: [{ id: 'ws1', title: 'Demo', url: 'https://x.dev', description: '', startDate: '2024-01-01', endDate: '0000-00-00' }],
  languages: [{ proficiency: { id: 3, value: 'Expert' }, ability: ['read', 'speak'], lang: 'English', languageId: 'l1', entityLanguageId: '1' }],
};

test('sections read from the full profile', () => {
  const s = parseSections(full);
  assert.deepEqual(s.employments[0], {
    id: 'emp1',
    current: true,
    designation: { id: '5555', name: 'Software Engineer 2' },
    company: { id: '4719567', name: '7EDGE' },
    start: '2025-11',
    end: null,
    description: 'Full stack',
    skills: ['React.js', 'Node.js'],
    experienceType: 'F',
  });
  assert.deepEqual(s.itSkills[0], { id: 'sk1', skill: { id: '56097', name: 'React.js' }, version: '19', lastUsed: 2026, experience: { years: 3, months: 5 } });
  assert.equal(s.educations[0].institute.id, 'PG725218');
  assert.deepEqual(s.educations[0].course, { id: 12, name: 'B.Tech / B.E.' });
  assert.equal(s.workSamples[0].end, 'current');
  assert.deepEqual(s.languages[0], { id: 'l1', language: 'English', languageRef: '1', proficiency: 3, read: true, write: false, speak: true });
  assert.deepEqual(s.projects, []);
  assert.deepEqual(parseBasics(full), { name: 'Sanjeev', city: { id: 17, name: 'Hyderabad' }, experience: { years: 3, months: 6 }, currentSalary: { amount: 750000, currency: 'INR' } });
  assert.deepEqual(parsePersonal(full), { birthDate: '2000-09-14', gender: 'M', address: '', hometown: '', pincode: '', maritalStatus: 'N' });
  assert.equal(parsePersonal({ profile: [{ maritalStatus: { id: null, value: null } }] }).maritalStatus, null);
});

test('sections write back the shapes Naukri\'s profile page saves', () => {
  const s = parseSections(full);
  assert.deepEqual(sectionBodies('employments', s.employments), [
    {
      employments: [
        {
          employmentType: 'current',
          jobDescription: 'Full stack',
          organization: '7EDGE',
          organizationId: '4719567',
          designation: 'Software Engineer 2',
          designationId: '5555',
          keySkills: 'React.js, Node.js',
          startDate: '2025-11-01',
          endDate: '',
          experienceType: 'F',
          employmentId: 'emp1',
        },
      ],
    },
  ]);
  assert.deepEqual(sectionBodies('itSkills', s.itSkills)[0], {
    itskills: [{ entitySkill: 'React.js', entitySkillId: '56097', version: '19', lastUsed: { id: 2026, value: 2026 }, experienceTime: { year: 3, month: 5 }, sid: 'sk1' }],
  });
  const [edu] = sectionBodies('educations', s.educations);
  assert.deepEqual((edu.educations as any[])[0].entityInstitute, { id: 'PG725218', value: 'Dr. Mahalingam College' });
  // A new item has no id; accomplishments go together in one save.
  const two = [...s.onlineProfiles, { name: 'GitHub', url: 'https://github.com/x', description: '' }];
  assert.deepEqual(sectionBodies('onlineProfiles', two), [
    {
      onlineProfiles: [
        { profile: 'LinkedIn', url: 'https://www.linkedin.com/in/x', description: '', onlineProfileId: 'op1' },
        { profile: 'GitHub', url: 'https://github.com/x', description: '' },
      ],
    },
  ]);
  assert.deepEqual(sectionBodies('workSamples', s.workSamples)[0], {
    workSamples: [{ title: 'Demo', url: 'https://x.dev', description: '', startDate: '2024-01-01', endDate: '0000-00-00', workSampleId: 'ws1' }],
  });
  assert.deepEqual(
    sectionBodies('certifications', [{ name: { id: null, name: 'AWS SAA' }, url: '', issued: '2025-03', expires: 'never' }])[0],
    {
      certifications: [
        { certificationId: '', entityCertificateId: null, course: 'AWS SAA', vendorId: null, vendor: null, bodytype: '', completionId: '', url: '', issueDate: '03-2025', expiryDate: '00-0000' },
      ],
    },
  );
  assert.deepEqual(sectionBodies('languages', s.languages)[0], {
    languages: [{ lang: 'English', entityLanguageId: '1', proficiency: { id: 3, value: 'Expert' }, ability: ['read', 'speak'], languageId: 'l1' }],
  });
  assert.deepEqual(sectionBodies('projects', []), []);
});

test('an IT skill saves its last-used year as the {id, value} Naukri reads it as', () => {
  const item = { skill: { id: '1', name: 'Go' }, version: '', lastUsed: null, experience: { years: 1, months: 0 } };
  assert.deepEqual((sectionBodies('itSkills', [item])[0].itskills as any[])[0].lastUsed, { id: '', value: '' });
});

test('basics and personal details become profile fields', () => {
  assert.deepEqual(basicsProfile({ city: { id: 139, name: 'Pune' }, experience: { years: 4, months: 2 }, currentSalary: { amount: 900000, currency: 'INR' } }), {
    city: { id: 139, value: 'Pune' },
    experience: { year: 4, month: 2 },
    currency: 'INR',
    absoluteCtc: '900000',
  });
  // Naukri allows only its letter codes: "Allowed Values : [N, M, W, D, S, O]".
  assert.deepEqual(personalProfile({ pincode: ' 500081 ', maritalStatus: 'N' }), { pincode: '500081', maritalStatus: { id: 'N', value: 'Single/unmarried' } });
});
