plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.jetbrains.kotlin.android)
}

android {
    namespace = "com.cimoc.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.cimoc.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = "1.8"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)

    // lynx dependencies
    implementation("org.lynxsdk.lynx:lynx:3.8.0")
    implementation("org.lynxsdk.lynx:lynx-jssdk:3.8.0")
    implementation("org.lynxsdk.lynx:lynx-trace:3.8.0")
    implementation("org.lynxsdk.lynx:primjs:3.8.0")

    // image-service (Fresco is required by lynx-service-image)
    implementation("org.lynxsdk.lynx:lynx-service-image:3.8.0")
    implementation("com.facebook.fresco:fresco:2.3.0")
    implementation("com.facebook.fresco:animated-gif:2.3.0")
    implementation("com.facebook.fresco:animated-webp:2.3.0")
    implementation("com.facebook.fresco:webpsupport:2.3.0")
    implementation("com.facebook.fresco:animated-base:2.3.0")

    // log / http services
    implementation("org.lynxsdk.lynx:lynx-service-log:3.8.0")
    implementation("org.lynxsdk.lynx:lynx-service-http:3.8.0")
    implementation("com.squareup.okhttp3:okhttp:4.9.0")

    // XElement behaviors (required by lynx-ui components)
    implementation("org.lynxsdk.lynx:xelement:3.8.0")
    implementation("org.lynxsdk.lynx:xelement-input:3.8.0")
    implementation("org.lynxsdk.lynx:xelement-overlay:3.8.0")
    implementation("org.lynxsdk.lynx:xelement-refresh:3.8.0")
}
