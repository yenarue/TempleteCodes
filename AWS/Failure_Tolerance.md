장애허용 시스템 설계하기
====

오류는 피할 수 없다. 

## 장애허용

오류가 발생해도 시스템은 중단하지 않고 요청을 계속 처리하도록 한다.

사용자에게 높은 품질의 서비스를 제공할 수 있다.

### 어떻게 달성할 수 있나

* 단일 장애 지점 (SPOF) 이 있는 시스템은 장애허용 시스템이 될 수 없음
* 시스템의 각 부분을 디커플링하면 장애허용 달성가능
* 시스템을 장애허용 블록으로 구성하면 가능
  * AWS 의 대부분의 리소스들이 장애허용임
  * EC2는 제외 -> 오토스케일링 그룹, 일래스틱 로드 밸런싱 (ELB), 심플큐서비스(SQS) 로 해결 가능

### 단일 장애 지점 vs 고가용성 vs 장애허용

* 단일 장재 지점 (아무것도 보장하지 않는 것) : 오류가 발생하면 어떤 요청도 처리되지 않음

  * 아마존 EC2 인스턴스 
  * 아마존 RDS 단일 인스턴스

* 고가용성 : 오류가 발생하면 요청이 이전처럼 처리 될 때까지 시간이 좀 걸림

  * 일래스틱 네트워크 인터페이스 (ENI)
  * VPC 서브넷
  * 아마존 EBS 볼륨
  * 아마존 RDS Multi AZ 인스턴스

* 장애허용 : 오류가 발생해도 요청은 가용성 문제없이 이전처럼 처리됨

  대부분의 AWS 리소스들......

  * ELB (두 개 이상의 AZ에 배포한 경우)
  * 아마존 EC2 보안그룹
  * 아마존 VPC (ACL 및 라우트 테이블과 함께)
  * 일래스틱 IP 주소 (EIP)
  * 아마존 S3
  * 아마존 EBS 스냅샷
  * 아마존 DynamoDB
  * 아마존 클라우드와치
  * 오토스케일링 그룹
  * 아마존 SQS
  * AWS 일래스틱 빈스토크 (EB)
  * AWS OpsWorks
  * AWS CloudFormation
  * AWS IAM



## EC2 인스턴스 기반 장애허용 웹 앱을 설계해보자

### 1. EC2 인스턴스를 중복 사용하여 가용성 높히기

* 단일 EC2 인스턴스는 단일 장애 지점 이다 : 장애발생하면 걍 시스템 쥬금
  * 하드웨어/네트워크/전력공급/소프트웨어 문제 등으로 장애는 언제든 발생할 수 있음

#### 중복

여러개의 인스턴스를 두기

* 하나의 인스턴스가 오류가 나도 다른 인스턴스가 정상이니 오케이
* 보통 3배로 늘린다.
* 가용영역, 오토스케일링을 활용하면 가능
* 단점 : 리소스가 늘어남, 인스턴스끼리의 통신문제 존재

#### 디커플링

오류가 발생한 인스턴스에는 라우팅되지 않도록 해야 한다.

* 로드밸런서(ELB)를 추가하는 방법

* SQS 큐를 추가하는 방법 : 비동기 디커플링

### 2. 응용단에서의 장애허용

장애허용 관련 코드를 작성해야 한다.

#### 크래시 허용/재시도

크래시를 허용하고 **재시도** 하도록 작성하자!

* 크래시되게 내버려두라 / 재시도하라 / 실패하려면 빨리 실패하라 (fail-fast)
* **동기적 디커플링 시나리오** : 재시도 로직 구현 필수. 전송자가 재요청하도록 하는 로직 필요
* **비동기적 디커플링 시나리오** : 실패하면 해당 op/메세지를 그냥 큐로 다시 보낸다. (그러면 다음 루프에서 다음 처리자가 처리하게 됨) 즉, 비동기적 시나리오에서는 재시도가 자연스럽게 기본적으로 구현됨
* 언제나 재시도가 필요한 것은 아니다
  * 잘못된 요청인 경우 : 몇번을 재시도해도 항상 FAIL... 이런건 재시도하지 말자
  * 데이터베이스 등의 연결 및 인터널 에러 : 재시도하면 됨

#### 멱등한 재시도

멱등한 재시도는 장애허용을 가능하게 한다.

* 여러번의 재시도가 일어나도 한번의 정상 실행만을 보장하는 것

### 3. 장애허용 웹 앱 아키텍처 설계 : [Imagery](https://github.com/AWSinAction/code/tree/master/chapter13)

* AWS 람다 : 60초 이내의 짧은 로직. AWS 리소스들의 상태에 트리거 할 수 있음
  * 예) SQS에 새 메세지가 도달하면 람다 함수를 실행한다 등...
* 아마존 API 게이트웨이 : EC2 인스턴스를 실행하지 않고도 REST API를 실행할 수 있도록 한다.
  * `GET /some/resource` 요청이 수신될 때마다 람다가 실행되도록 할 수 있음!
  * **AWS 람다 + API 게이트웨이 = 유지보수가 필요한 EC2 인스턴스 없이도 강력한 서비스를 구축할 수 있음!!!**
  * 모든 리전에서 사용할 수 있지는 않다. 특정 리전에 구속...



#### 실습

1. CloudFormation 으로 스택을 생성한다.

```bash
$ aws cloudformation create-stack --stack-name imagery --template-url https://s3.amazonaws.com/awsinaction/chapter13/template.json --capabilities CAPABILITY_IAM
```

* S3, DynamoDB, SQS 배포가 이루어짐
* Imagery 앱
  * Server와 Worker에 대한 IAM Role 설정
  * Server용 EB, Worker용 EB

2. CloudFormation 스택의 상태 확인

```bash
$ aws cloudformation describe-stacks --stack-name imagery
# OutputValue 의 값이 접속 URL임
```

3. 클린업

```bash
$ aws iam get-user --query "User.Arn" --output text
# 계정 정보가 출력됨
# arn:aws:iam::AccountId:user/mycli

$ aws s3 rm s3://imagery-$AccountId -recursive
$ aws cloudformation delete-stack --stack-name imagery
```



## 요약

* 장애 허용 : 오류가 발생할 것을 예상하고 장애 해결을 할 수 있는 시스템을 설계하는 것

* 장애 허용의 구현

  * 앱에서 멱등한 동작을 사용하여 상태 전환을 해야함

  * 무상태 서버 : 서버가 상태를 갖지 않아야 함

* AWS 의 EC2는 장애 허용이 안됨

  * 중복 EC2 인스턴스를 이용하여 단일 장애 지점 제거
  * 여러 가용영역에서 중복 인스턴스를 운영 + 오토스케일링 그룹 = EC2 장애허용ㅇㅋ