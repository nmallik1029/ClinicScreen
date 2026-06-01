import { PrismaClient, MediaType, DeviceStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean slate (dev only)
  await prisma.playlistItem.deleteMany();
  await prisma.deviceCommand.deleteMany();
  await prisma.device.deleteMany();
  await prisma.playlist.deleteMany();
  await prisma.media.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
  await prisma.practice.deleteMany();

  const practice = await prisma.practice.create({
    data: { name: "Test Cardiology Clinic", specialty: "Cardiology" },
  });

  const location = await prisma.location.create({
    data: { practiceId: practice.id, name: "Main Office", address: "123 Heart St" },
  });

  // Test users. To sign in, create matching Clerk accounts with these emails.
  await prisma.user.create({
    data: {
      email: "superadmin@clinicscreen.example",
      name: "Platform Admin",
      role: "SUPERADMIN",
    },
  });

  await prisma.user.create({
    data: {
      email: "admin@testcardiology.example",
      name: "Front Desk Admin",
      role: "OFFICE_ADMIN",
      practiceId: practice.id,
    },
  });

  const [bpVideo, providerImg, qrImg, prepVideo] = await Promise.all([
    prisma.media.create({
      data: {
        practiceId: practice.id,
        title: "Blood Pressure Basics",
        type: MediaType.VIDEO,
        url: "https://example.com/media/blood-pressure-basics.mp4",
        durationSeconds: 90,
      },
    }),
    prisma.media.create({
      data: {
        practiceId: practice.id,
        title: "Meet the Provider",
        type: MediaType.IMAGE,
        url: "https://example.com/media/meet-the-provider.png",
        durationSeconds: 10,
      },
    }),
    prisma.media.create({
      data: {
        practiceId: practice.id,
        title: "Patient Portal QR",
        type: MediaType.IMAGE,
        url: "https://example.com/media/patient-portal-qr.png",
        durationSeconds: 10,
      },
    }),
    prisma.media.create({
      data: {
        practiceId: practice.id,
        title: "Appointment Prep",
        type: MediaType.VIDEO,
        url: "https://example.com/media/appointment-prep.mp4",
        durationSeconds: 120,
      },
    }),
  ]);

  const waitingPlaylist = await prisma.playlist.create({
    data: {
      practiceId: practice.id,
      name: "Cardiology Waiting Room",
      items: {
        create: [
          { mediaId: bpVideo.id, position: 1 },
          { mediaId: providerImg.id, position: 2 },
          { mediaId: qrImg.id, position: 3 },
        ],
      },
    },
  });

  const examPlaylist = await prisma.playlist.create({
    data: {
      practiceId: practice.id,
      name: "Exam Room Education",
      items: {
        create: [
          { mediaId: prepVideo.id, position: 1 },
          { mediaId: bpVideo.id, position: 2 },
        ],
      },
    },
  });

  await prisma.device.create({
    data: {
      practiceId: practice.id,
      locationId: location.id,
      name: "Waiting Room",
      roomType: "Waiting Room",
      status: DeviceStatus.ONLINE,
      lastSeenAt: new Date(),
      assignedPlaylistId: waitingPlaylist.id,
    },
  });

  await prisma.device.create({
    data: {
      practiceId: practice.id,
      locationId: location.id,
      name: "Exam Room 1",
      roomType: "Exam Room",
      status: DeviceStatus.OFFLINE,
      assignedPlaylistId: examPlaylist.id,
    },
  });

  await prisma.device.create({
    data: {
      practiceId: practice.id,
      locationId: location.id,
      name: "Hallway",
      roomType: "Hallway",
      status: DeviceStatus.UNKNOWN,
    },
  });

  console.log("Seed complete:", practice.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
